import { NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/auth';
import { getPublishedSitesDatabase } from '@/lib/published-sites';
import { addProjectDomain } from '@/lib/vercel-domains';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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

  if (
    html.length < 100 ||
    html.length > 200_000 ||
    !/<html|<!doctype/i.test(html) ||
    !/<\/html>\s*$/i.test(html)
  ) {
    return NextResponse.json(
      { error: 'This site is incomplete or too large to publish.' },
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
  const title = extractTitle(html);
  const now = Date.now();

  if (customDomain) {
    try {
      await addProjectDomain(customDomain);
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
      SET title = ${title}, html = ${html}, source_prompt = ${prompt},
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
      });
    }
  }

  const slug = requestedSlug || createSlug(title);
  try {
    await database`
      INSERT INTO published_sites
        (id, slug, title, html, source_prompt, custom_domain, domain_status, user_id, created_at, updated_at)
      VALUES
        (${crypto.randomUUID()}, ${slug}, ${title}, ${html}, ${prompt},
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
  });
}
