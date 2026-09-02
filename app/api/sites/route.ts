import { NextResponse } from 'next/server';

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
      { error: 'Sign in to view your websites.' },
      { status: 401 },
    );
  }

  try {
    const database = await getPublishedSitesDatabase();
    const rows = await database`
      SELECT slug, title, pages_json, custom_domain, domain_status, created_at, updated_at
      FROM published_sites
      WHERE user_id = ${user.id}
      ORDER BY updated_at DESC
      LIMIT 100
    `;

    const sites = rows.map((row) => {
      const site = row as {
        slug: string;
        title: string;
        pages_json: string;
        custom_domain: string | null;
        domain_status: string;
        created_at: number | string;
        updated_at: number | string;
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
        createdAt: Number(site.created_at),
        updatedAt: Number(site.updated_at),
      };
    });

    return NextResponse.json(
      { sites },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Your websites could not be loaded. Please try again.' },
      { status: 503 },
    );
  }
}
