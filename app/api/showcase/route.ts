import { NextResponse } from 'next/server';

import { getPublishedSitesDatabase } from '@/lib/published-sites';

export const runtime = 'nodejs';
export const maxDuration = 10;

type ShowcaseRow = {
  slug: string;
  title: string;
  custom_domain: string | null;
  domain_status: string;
  created_at: number | string;
  total_visits: number | string;
};

function getSiteUrl(site: ShowcaseRow) {
  if (site.custom_domain && site.domain_status === 'dns_verified') {
    return `https://${site.custom_domain}`;
  }

  const freeSiteDomain =
    process.env.NEXT_PUBLIC_FREE_SITE_DOMAIN?.trim().toLowerCase();
  const siteOrigin = (
    process.env.NEXT_PUBLIC_SITE_ORIGIN || 'https://www.freeable.ai'
  ).replace(/\/$/, '');
  return freeSiteDomain
    ? `https://${site.slug}.${freeSiteDomain}`
    : `${siteOrigin}/s/${site.slug}`;
}

function serializeSite(row: ShowcaseRow) {
  return {
    slug: row.slug,
    title: row.title,
    url: getSiteUrl(row),
    visits: Number(row.total_visits || 0),
    createdAt: Number(row.created_at),
  };
}

export async function GET() {
  try {
    const database = await getPublishedSitesDatabase();
    const [popularResult, latestResult] = await Promise.all([
      database`
        SELECT published_sites.slug, published_sites.title,
               published_sites.custom_domain, published_sites.domain_status,
               published_sites.created_at,
               COALESCE(SUM(site_traffic_daily.views), 0)::bigint AS total_visits
        FROM published_sites
        LEFT JOIN site_traffic_daily
          ON site_traffic_daily.site_slug = published_sites.slug
        WHERE COALESCE(LOWER(published_sites.custom_domain), '') NOT IN
          ('freepokemoncall.com', 'www.freepokemoncall.com')
        GROUP BY published_sites.slug, published_sites.title,
                 published_sites.custom_domain, published_sites.domain_status,
                 published_sites.created_at
        ORDER BY total_visits DESC, published_sites.created_at DESC
        LIMIT 3
      `,
      database`
        SELECT published_sites.slug, published_sites.title,
               published_sites.custom_domain, published_sites.domain_status,
               published_sites.created_at,
               COALESCE(SUM(site_traffic_daily.views), 0)::bigint AS total_visits
        FROM published_sites
        LEFT JOIN site_traffic_daily
          ON site_traffic_daily.site_slug = published_sites.slug
        WHERE COALESCE(LOWER(published_sites.custom_domain), '') NOT IN
          ('freepokemoncall.com', 'www.freepokemoncall.com')
        GROUP BY published_sites.slug, published_sites.title,
                 published_sites.custom_domain, published_sites.domain_status,
                 published_sites.created_at
        ORDER BY published_sites.created_at DESC
        LIMIT 3
      `,
    ]);
    const popularRows = popularResult as unknown as ShowcaseRow[];
    const latestRows = latestResult as unknown as ShowcaseRow[];

    return NextResponse.json(
      {
        popular: popularRows.map(serializeSite),
        latest: latestRows.map(serializeSite),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: 'The website showcase could not be loaded.' },
      { status: 503 },
    );
  }
}
