import {
  createPublishedSiteResponse,
  parsePublishedPages,
  selectPublishedPage,
} from '@/lib/published-site-response';
import { getPublishedSitesDatabase } from '@/lib/published-sites';

const domainPattern =
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ domain: string; path?: string[] }> },
) {
  const { domain: rawDomain, path = [] } = await context.params;
  const domain = decodeURIComponent(rawDomain).toLowerCase();
  if (!domainPattern.test(domain))
    return new Response('Site not found', { status: 404 });

  const database = await getPublishedSitesDatabase();
  const rows = (await database`
    SELECT slug, title, html, pages_json
    FROM published_sites
    WHERE custom_domain = ${domain}
    LIMIT 1
  `) as Array<{
    slug: string;
    title: string;
    html: string;
    pages_json: string | null;
  }>;
  const site = rows[0];
  if (!site) return new Response('Site not found', { status: 404 });

  const pages = parsePublishedPages(site.pages_json, site.html, site.title);
  const page = selectPublishedPage(pages, path.join('/'));
  if (!page) return new Response('Page not found', { status: 404 });

  const requestUrl = new URL(request.url);
  const analytics = requestUrl.searchParams.has('freeable_preview')
    ? undefined
    : {
        endpointOrigin: requestUrl.origin,
        siteSlug: site.slug,
        pagePath: page.slug,
      };
  return createPublishedSiteResponse(page, pages, '', analytics);
}
