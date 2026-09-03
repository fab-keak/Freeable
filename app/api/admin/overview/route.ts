import { NextResponse } from 'next/server';

import { isAdminEmail } from '@/lib/admin';
import { getAuthenticatedUser } from '@/lib/auth';
import { getPublishedSitesDatabase } from '@/lib/published-sites';

export const runtime = 'nodejs';

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
      { error: 'Sign in to open the admin dashboard.' },
      { status: 401 },
    );
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json(
      { error: 'You do not have access to the admin dashboard.' },
      { status: 403 },
    );
  }

  try {
    const database = await getPublishedSitesDatabase();
    const [statsRows, userRows, siteRows] = await Promise.all([
      database`
        SELECT
          (SELECT COUNT(*)::int FROM accounts) AS user_count,
          (SELECT COUNT(*)::int FROM published_sites) AS website_count,
          (SELECT COUNT(*)::int FROM published_sites
            WHERE custom_domain IS NOT NULL) AS custom_domain_count,
          (SELECT COUNT(*)::int FROM published_sites
            WHERE created_at >= ${Date.now() - 7 * 24 * 60 * 60 * 1_000}) AS websites_this_week
      `,
      database`
        SELECT accounts.id, accounts.name, accounts.email, accounts.created_at,
               COUNT(published_sites.id)::int AS website_count,
               MAX(published_sites.updated_at) AS last_website_update
        FROM accounts
        LEFT JOIN published_sites ON published_sites.user_id = accounts.id
        GROUP BY accounts.id, accounts.name, accounts.email, accounts.created_at
        ORDER BY accounts.created_at DESC
      `,
      database`
        SELECT published_sites.slug, published_sites.title,
               published_sites.pages_json, published_sites.custom_domain,
               published_sites.domain_status, published_sites.created_at,
               published_sites.updated_at, accounts.name AS owner_name,
               accounts.email AS owner_email
        FROM published_sites
        LEFT JOIN accounts ON accounts.id = published_sites.user_id
        ORDER BY published_sites.updated_at DESC
      `,
    ]);

    const stats = (statsRows[0] || {}) as {
      user_count?: number | string;
      website_count?: number | string;
      custom_domain_count?: number | string;
      websites_this_week?: number | string;
    };

    return NextResponse.json(
      {
        stats: {
          users: Number(stats.user_count || 0),
          websites: Number(stats.website_count || 0),
          customDomains: Number(stats.custom_domain_count || 0),
          websitesThisWeek: Number(stats.websites_this_week || 0),
        },
        users: userRows.map((row) => {
          const account = row as {
            id: string;
            name: string;
            email: string;
            created_at: number | string;
            website_count: number | string;
            last_website_update: number | string | null;
          };
          return {
            id: account.id,
            name: account.name,
            email: account.email,
            websiteCount: Number(account.website_count || 0),
            joinedAt: Number(account.created_at),
            lastWebsiteUpdate: account.last_website_update
              ? Number(account.last_website_update)
              : null,
          };
        }),
        websites: siteRows.map((row) => {
          const site = row as {
            slug: string;
            title: string;
            pages_json: string;
            custom_domain: string | null;
            domain_status: string;
            created_at: number | string;
            updated_at: number | string;
            owner_name: string | null;
            owner_email: string | null;
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
            customDomain,
            domainStatus: site.domain_status,
            pageCount: getPageCount(site.pages_json),
            ownerName: site.owner_name || 'Unknown user',
            ownerEmail: site.owner_email || '',
            createdAt: Number(site.created_at),
            updatedAt: Number(site.updated_at),
          };
        }),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'The admin dashboard could not be loaded.' },
      { status: 503 },
    );
  }
}
