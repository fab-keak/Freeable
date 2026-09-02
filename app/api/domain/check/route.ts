import { NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/auth';
import { getPublishedSitesDatabase } from '@/lib/published-sites';
import { domainTarget } from '@/lib/vercel-domains';

const domainPattern =
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request).catch(() => null);
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to manage this domain.' },
      { status: 401 },
    );
  }

  let body: { domain?: unknown; slug?: unknown };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: 'The domain check was not valid.' },
      { status: 400 },
    );
  }

  const domain =
    typeof body.domain === 'string'
      ? body.domain
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/\/$/, '')
      : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';

  if (!domainPattern.test(domain) || !slugPattern.test(slug)) {
    return NextResponse.json(
      { error: 'The domain or site address is not valid.' },
      { status: 400 },
    );
  }

  try {
    const database = await getPublishedSitesDatabase();
    const ownedSites = await database`
      SELECT slug FROM published_sites
      WHERE slug = ${slug} AND custom_domain = ${domain} AND user_id = ${user.id}
      LIMIT 1
    `;
    if (!ownedSites.length) {
      return NextResponse.json(
        { error: 'This domain is not attached to your account.' },
        { status: 404 },
      );
    }

    const dnsResponse = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=CNAME`,
      {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!dnsResponse.ok) throw new Error('dns-unavailable');

    const dns = (await dnsResponse.json()) as {
      Answer?: Array<{ data?: string; type?: number }>;
    };
    const connected = Boolean(
      dns.Answer?.some(
        (answer) =>
          answer.type === 5 &&
          answer.data?.replace(/\.$/, '').toLowerCase() === domainTarget,
      ),
    );

    await database`
      UPDATE published_sites
      SET domain_status = ${connected ? 'dns_verified' : 'pending_dns'},
          updated_at = ${Date.now()}
      WHERE slug = ${slug} AND custom_domain = ${domain} AND user_id = ${user.id}
    `;

    return NextResponse.json({ connected, domain, target: domainTarget });
  } catch {
    return NextResponse.json(
      { error: 'DNS could not be checked right now. Please try again.' },
      { status: 502 },
    );
  }
}
