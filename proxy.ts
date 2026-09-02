import { NextRequest, NextResponse } from 'next/server';

function isBuilderHost(hostname: string) {
  const configuredHosts = (process.env.BUILDER_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.vercel.app') ||
    configuredHosts.includes(hostname)
  );
}

export function proxy(request: NextRequest) {
  const hostname = (request.headers.get('host') || '')
    .split(':')[0]
    .toLowerCase();
  if (!hostname || isBuilderHost(hostname)) return NextResponse.next();

  const url = request.nextUrl.clone();
  const freeSiteDomain = process.env.NEXT_PUBLIC_FREE_SITE_DOMAIN
    ?.trim()
    .toLowerCase();
  if (freeSiteDomain && hostname.endsWith(`.${freeSiteDomain}`)) {
    const slug = hostname.slice(0, -(freeSiteDomain.length + 1));
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      url.pathname = `/s/${slug}`;
      url.search = '';
      return NextResponse.rewrite(url);
    }
  }

  url.pathname = `/site-domain/${encodeURIComponent(hostname)}`;
  url.search = '';
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!api|_next|site-domain|favicon.svg|og.png).*)'],
};
