import { getPublishedSitesDatabase } from '@/lib/published-sites';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (!slugPattern.test(slug)) return new Response('Site not found', { status: 404 });

  const database = await getPublishedSitesDatabase();
  const rows = (await database`
    SELECT html FROM published_sites WHERE slug = ${slug} LIMIT 1
  `) as Array<{ html: string }>;
  const site = rows[0];

  if (!site) return new Response('Site not found', { status: 404 });

  return new Response(site.html, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      'Content-Security-Policy': [
        'sandbox allow-scripts allow-forms allow-modals allow-popups',
        "default-src 'none'",
        "script-src 'unsafe-inline' https:",
        "style-src 'unsafe-inline' https:",
        'img-src https: data: blob:',
        'font-src https: data:',
        'media-src https: data: blob:',
        'connect-src https:',
        'frame-src https:',
      ].join('; '),
      'Content-Type': 'text/html; charset=utf-8',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
