import { NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/auth';
import { reconcileDomainOrdersForUser } from '@/lib/domain-orders';
import { getPublishedSitesDatabase } from '@/lib/published-sites';

export const runtime = 'nodejs';
export const maxDuration = 30;

function getFreeSiteUrl(slug: string) {
  const freeSiteDomain =
    process.env.NEXT_PUBLIC_FREE_SITE_DOMAIN?.trim().toLowerCase();
  const siteOrigin = (
    process.env.NEXT_PUBLIC_SITE_ORIGIN || 'https://www.freeable.ai'
  ).replace(/\/$/, '');
  return freeSiteDomain
    ? `https://${slug}.${freeSiteDomain}`
    : `${siteOrigin}/s/${slug}`;
}

function getPageCount(value: unknown) {
  if (typeof value !== 'string') return 1;
  try {
    const pages = JSON.parse(value) as unknown;
    return Array.isArray(pages) ? Math.max(1, pages.length) : 1;
  } catch {
    return 1;
  }
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to view your websites.' },
      { status: 401 },
    );
  }

  try {
    await reconcileDomainOrdersForUser(user.id).catch(() => undefined);
    const database = await getPublishedSitesDatabase();
    const sevenDayCutoff = new Date(Date.now() - 6 * 24 * 60 * 60 * 1_000)
      .toISOString()
      .slice(0, 10);
    const [rows, dailyRows] = await Promise.all([
      database`
        SELECT published_sites.slug, published_sites.title,
               published_sites.pages_json, published_sites.custom_domain,
               published_sites.domain_status, published_sites.created_at,
               published_sites.updated_at,
               COALESCE(traffic.total_views, 0)::bigint AS total_views,
               COALESCE(traffic.views_last_7_days, 0)::bigint AS views_last_7_days,
               domain_order.domain AS order_domain,
               domain_order.status AS order_status,
               domain_order.failure_message AS order_message,
               domain_order.updated_at AS order_updated_at
        FROM published_sites
        LEFT JOIN (
          SELECT site_slug,
                 SUM(views)::bigint AS total_views,
                 COALESCE(
                   SUM(views) FILTER (WHERE view_date >= ${sevenDayCutoff}),
                   0
                 )::bigint AS views_last_7_days
          FROM site_traffic_daily
          GROUP BY site_slug
        ) AS traffic ON traffic.site_slug = published_sites.slug
        LEFT JOIN LATERAL (
          SELECT domain, status, failure_message, updated_at
          FROM domain_orders
          WHERE domain_orders.site_slug = published_sites.slug
            AND domain_orders.user_id = published_sites.user_id
          ORDER BY domain_orders.created_at DESC
          LIMIT 1
        ) AS domain_order ON true
        WHERE published_sites.user_id = ${user.id}
        ORDER BY published_sites.updated_at DESC
        LIMIT 100
      `,
      database`
        SELECT site_traffic_daily.view_date,
               SUM(site_traffic_daily.views)::bigint AS views
        FROM site_traffic_daily
        INNER JOIN published_sites
          ON published_sites.slug = site_traffic_daily.site_slug
        WHERE published_sites.user_id = ${user.id}
          AND site_traffic_daily.view_date >= ${sevenDayCutoff}
        GROUP BY site_traffic_daily.view_date
        ORDER BY site_traffic_daily.view_date ASC
      `,
    ]);

    const sites = rows.map((row) => {
      const site = row as {
        slug: string;
        title: string;
        pages_json: string;
        custom_domain: string | null;
        domain_status: string;
        created_at: number | string;
        updated_at: number | string;
        total_views: number | string;
        views_last_7_days: number | string;
        order_domain: string | null;
        order_status: string | null;
        order_message: string | null;
        order_updated_at: number | string | null;
      };
      const customDomain = site.custom_domain || null;
      const customDomainConnected =
        customDomain && site.domain_status === 'dns_verified';

      return {
        slug: site.slug,
        title: site.title,
        url: customDomainConnected
          ? `https://${customDomain}`
          : getFreeSiteUrl(site.slug),
        freeUrl: getFreeSiteUrl(site.slug),
        customDomain,
        domainStatus: site.domain_status,
        pageCount: getPageCount(site.pages_json),
        totalViews: Number(site.total_views || 0),
        viewsLast7Days: Number(site.views_last_7_days || 0),
        domainOrder:
          site.order_domain && site.order_status
            ? {
                domain: site.order_domain,
                status: site.order_status,
                message: site.order_message,
                updatedAt: Number(site.order_updated_at || 0),
              }
            : null,
        createdAt: Number(site.created_at),
        updatedAt: Number(site.updated_at),
      };
    });

    const viewsByDate = new Map(
      dailyRows.map((row) => {
        const day = row as { view_date: string; views: number | string };
        return [day.view_date, Number(day.views || 0)] as const;
      }),
    );
    const dailyViews = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1_000)
        .toISOString()
        .slice(0, 10);
      return { date, views: viewsByDate.get(date) || 0 };
    });
    const totalViews = sites.reduce((sum, site) => sum + site.totalViews, 0);
    const viewsLast7Days = sites.reduce(
      (sum, site) => sum + site.viewsLast7Days,
      0,
    );
    const topSite = [...sites].sort(
      (first, second) => second.totalViews - first.totalViews,
    )[0];

    return NextResponse.json(
      {
        sites,
        analytics: {
          totalViews,
          viewsLast7Days,
          dailyViews,
          topSite: topSite
            ? {
                slug: topSite.slug,
                title: topSite.title,
                url: topSite.url,
                totalViews: topSite.totalViews,
              }
            : null,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Your websites could not be loaded. Please try again.' },
      { status: 503 },
    );
  }
}
