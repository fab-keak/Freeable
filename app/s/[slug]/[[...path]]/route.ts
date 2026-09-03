import {
  createPublishedSiteResponse,
  parsePublishedPages,
  selectPublishedPage,
} from '@/lib/published-site-response';
import { getPublishedSitesDatabase } from '@/lib/published-sites';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string; path?: string[] }> },
) {
  const { slug, path = [] } = await context.params;
  if (!slugPattern.test(slug))
    return new Response('Site not found', { status: 404 });

  const database = await getPublishedSitesDatabase();
  const rows = (await database`
    SELECT title, html, pages_json
    FROM published_sites
    WHERE slug = ${slug}
    LIMIT 1
  `) as Array<{ title: string; html: string; pages_json: string | null }>;
  const site = rows[0];
  if (!site) return new Response('Site not found', { status: 404 });

  const pages = parsePublishedPages(site.pages_json, site.html, site.title);
  const page = selectPublishedPage(pages, path.join('/'));
  if (!page) return new Response('Page not found', { status: 404 });

  return createPublishedSiteResponse(page, pages, `/s/${slug}`, {
    endpointOrigin: new URL(request.url).origin,
    siteSlug: slug,
    pagePath: page.slug,
  });
}
