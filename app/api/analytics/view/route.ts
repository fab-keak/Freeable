import { getPublishedSitesDatabase } from '@/lib/published-sites';

export const runtime = 'nodejs';
export const maxDuration = 10;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const pagePathPattern =
  /^(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;
const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: responseHeaders });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > 500) {
      return new Response(null, { status: 413, headers: responseHeaders });
    }

    const body = JSON.parse(rawBody) as { slug?: unknown; path?: unknown };
    const slug = typeof body.slug === 'string' ? body.slug : '';
    const pagePath = typeof body.path === 'string' ? body.path : '';
    if (
      !slugPattern.test(slug) ||
      pagePath.length > 200 ||
      !pagePathPattern.test(pagePath)
    ) {
      return new Response(null, { status: 400, headers: responseHeaders });
    }

    const database = await getPublishedSitesDatabase();
    const viewDate = new Date().toISOString().slice(0, 10);
    await database`
      INSERT INTO site_traffic_daily (site_slug, view_date, page_path, views)
      VALUES (${slug}, ${viewDate}, ${pagePath}, 1)
      ON CONFLICT (site_slug, view_date, page_path)
      DO UPDATE SET views = site_traffic_daily.views + 1
    `;
    return new Response(null, { status: 204, headers: responseHeaders });
  } catch {
    return new Response(null, { status: 503, headers: responseHeaders });
  }
}
