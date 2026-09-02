import { NextResponse } from 'next/server';

import { getPublishedSitesDatabase } from '@/lib/published-sites';
import { domainTarget } from '@/lib/vercel-domains';

const domainPattern =
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function POST(request: Request) {
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

    const database = await getPublishedSitesDatabase();
    await database`
      UPDATE published_sites
      SET domain_status = ${connected ? 'dns_verified' : 'pending_dns'},
          updated_at = ${Date.now()}
      WHERE slug = ${slug} AND custom_domain = ${domain}
    `;

    return NextResponse.json({ connected, domain, target: domainTarget });
  } catch {
    return NextResponse.json(
      { error: 'DNS could not be checked right now. Please try again.' },
      { status: 502 },
    );
  }
}
