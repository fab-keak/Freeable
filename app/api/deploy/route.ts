import { NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/auth';
import { getPublishedSitesDatabase } from '@/lib/published-sites';
import { addProjectDomain, type DomainDnsRecord } from '@/lib/vercel-domains';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const pageSlugPattern =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const domainPattern =
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return (match?.[1] || 'Untitled website')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function createSlug(title: string) {
  const base =
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 36) || 'site';
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

function getPublishedUrl(slug: string) {
  const freeSiteDomain =
    process.env.NEXT_PUBLIC_FREE_SITE_DOMAIN?.trim().toLowerCase();
  return freeSiteDomain ? `https://${slug}.${freeSiteDomain}` : `/s/${slug}`;
}

type PublishPage = { title: string; slug: string; html: string };

function isCompleteHtml(html: string) {
  return (
    html.length >= 100 &&
    html.length <= 200_000 &&
    /<html|<!doctype/i.test(html) &&
    /<\/html>\s*$/i.test(html)
  );
}

function extractInternalLinks(html: string) {
  const links = new Set<string>();
  const pattern = /<a\b[^>]*\bhref\s*=\s*(['"])(.*?)\1/gi;
  for (const match of html.matchAll(pattern)) {
    const href = match[2];
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const path = href.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
    if (!path || /^(api|_next|s)(\/|$)/.test(path)) continue;
    if (/\.[a-z0-9]{2,5}$/i.test(path)) continue;
    links.add(path.toLowerCase());
  }
  return links;
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) {
    return NextResponse.json(
      { error: 'Create an account or sign in before publishing.' },
      { status: 401 },
    );
  }

  let body: {
    html?: unknown;
    prompt?: unknown;
    slug?: unknown;
    customDomain?: unknown;
    pages?: unknown;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: 'The publish request was not valid.' },
      { status: 400 },
    );
  }

  const html = typeof body.html === 'string' ? body.html.trim() : '';
  const prompt =
    typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 4_000) : '';
  const requestedSlug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const customDomain =
    typeof body.customDomain === 'string'
      ? body.customDomain
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/\/$/, '')
      : '';
  const rawPages = Array.isArray(body.pages) ? body.pages : [];
  const pages: PublishPage[] = rawPages.length
    ? rawPages.map((page) => {
        const candidate =
          page && typeof page === 'object'
            ? (page as {
                title?: unknown;
                slug?: unknown;
                html?: unknown;
              })
            : {};
        return {
          title:
            typeof candidate.title === 'string'
              ? candidate.title.trim().slice(0, 80)
              : '',
          slug:
            typeof candidate.slug === 'string'
              ? candidate.slug.trim().toLowerCase()
              : '',
          html: typeof candidate.html === 'string' ? candidate.html.trim() : '',
        };
      })
    : [{ title: extractTitle(html), slug: '', html }];

  const slugs = new Set(pages.map((page) => page.slug));
  const invalidPages =
    pages.length < 1 ||
    pages.length > 8 ||
    !slugs.has('') ||
    slugs.size !== pages.length ||
    pages.some(
      (page) =>
        !page.title ||
        (page.slug !== '' && !pageSlugPattern.test(page.slug)) ||
        !isCompleteHtml(page.html),
    ) ||
    pages.reduce((total, page) => total + page.html.length, 0) > 800_000;

  if (!isCompleteHtml(html) || invalidPages) {
    return NextResponse.json(
      { error: 'This site is incomplete or too large to publish.' },
      { status: 400 },
    );
  }

  const missingPages = new Set<string>();
  for (const page of pages) {
    for (const link of extractInternalLinks(page.html)) {
      if (!slugs.has(link)) missingPages.add(link);
    }
  }
  if (missingPages.size) {
    return NextResponse.json(
      {
        error:
          'Build or remove every linked page before publishing your website.',
        missingPages: [...missingPages],
      },
      { status: 400 },
    );
  }

  if (requestedSlug && !slugPattern.test(requestedSlug)) {
    return NextResponse.json(
      { error: 'The published site address is not valid.' },
      { status: 400 },
    );
  }

  if (customDomain && !domainPattern.test(customDomain)) {
    return NextResponse.json(
      { error: 'Enter a domain such as www.example.com.' },
      { status: 400 },
    );
  }

  const database = await getPublishedSitesDatabase();
  const homePage = pages.find((page) => page.slug === '')!;
  const title = extractTitle(homePage.html);
  const pagesJson = JSON.stringify(pages);
  const now = Date.now();
  let dnsRecord: DomainDnsRecord | null = null;

  if (customDomain) {
    try {
      const configuration = await addProjectDomain(customDomain);
      dnsRecord = configuration.record;
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'The custom domain could not be added to Vercel.',
        },
        { status: 502 },
      );
    }
  }

  if (requestedSlug) {
    const rows = await database`
      UPDATE published_sites
      SET title = ${title}, html = ${homePage.html}, pages_json = ${pagesJson}, source_prompt = ${prompt},
          custom_domain = ${customDomain || null},
          domain_status = ${customDomain ? 'pending_dns' : 'none'},
          updated_at = ${now}
      WHERE slug = ${requestedSlug}
        AND user_id = ${user.id}
      RETURNING slug
    `;

    if (rows.length > 0) {
      return NextResponse.json({
        path: `/s/${requestedSlug}`,
        url: getPublishedUrl(requestedSlug),
        title,
        updated: true,
        customDomain: customDomain || null,
        domainStatus: customDomain ? 'pending_dns' : 'none',
        dnsRecord,
      });
    }
  }

  const slug = requestedSlug || createSlug(title);
  try {
    await database`
      INSERT INTO published_sites
        (id, slug, title, html, pages_json, source_prompt, custom_domain, domain_status, user_id, created_at, updated_at)
      VALUES
        (${crypto.randomUUID()}, ${slug}, ${title}, ${homePage.html}, ${pagesJson}, ${prompt},
         ${customDomain || null}, ${customDomain ? 'pending_dns' : 'none'}, ${user.id},
         ${now}, ${now})
    `;
  } catch {
    return NextResponse.json(
      { error: 'That free address is already taken. Try another name.' },
      { status: 409 },
    );
  }

  return NextResponse.json({
    path: `/s/${slug}`,
    url: getPublishedUrl(slug),
    title,
    updated: false,
    customDomain: customDomain || null,
    domainStatus: customDomain ? 'pending_dns' : 'none',
    dnsRecord,
  });
}
