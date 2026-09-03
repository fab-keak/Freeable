import { NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/auth';
import { parsePublishedPages } from '@/lib/published-site-response';
import { getPublishedSitesDatabase } from '@/lib/published-sites';

export const runtime = 'nodejs';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to edit this website.' },
      { status: 401 },
    );
  }

  const { slug } = await context.params;
  if (!slugPattern.test(slug)) {
    return NextResponse.json(
      { error: 'This website address is not valid.' },
      { status: 400 },
    );
  }

  try {
    const database = await getPublishedSitesDatabase();
    const rows = await database`
      SELECT slug, title, html, pages_json, source_prompt, custom_domain,
             domain_status, created_at, updated_at
      FROM published_sites
      WHERE slug = ${slug} AND user_id = ${user.id}
      LIMIT 1
    `;
    if (!rows[0]) {
      return NextResponse.json(
        { error: 'This website could not be found.' },
        { status: 404 },
      );
    }

    const site = rows[0] as {
      slug: string;
      title: string;
      html: string;
      pages_json: string | null;
      source_prompt: string;
      custom_domain: string | null;
      domain_status: string;
      created_at: number | string;
      updated_at: number | string;
    };
    const customDomain = site.custom_domain || null;
    const customDomainConnected =
      customDomain && site.domain_status === 'dns_verified';

    return NextResponse.json(
      {
        site: {
          slug: site.slug,
          title: site.title,
          url: customDomainConnected
            ? `https://${customDomain}`
            : getFreeSiteUrl(site.slug),
          freeUrl: getFreeSiteUrl(site.slug),
          customDomain,
          domainStatus: site.domain_status,
          sourcePrompt: site.source_prompt,
          pages: parsePublishedPages(site.pages_json, site.html, site.title),
          createdAt: Number(site.created_at),
          updatedAt: Number(site.updated_at),
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'This website could not be opened. Please try again.' },
      { status: 503 },
    );
  }
}
