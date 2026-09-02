export type PublishedPage = {
  title: string;
  slug: string;
  html: string;
};

const pageSlugPattern =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

export function parsePublishedPages(
  pagesJson: string | null,
  fallbackHtml: string,
  fallbackTitle = 'Home',
) {
  try {
    const parsed = JSON.parse(pagesJson || '[]') as unknown;
    if (!Array.isArray(parsed)) throw new Error('invalid');
    const pages = parsed.filter((page): page is PublishedPage =>
      Boolean(
        page &&
        typeof page === 'object' &&
        typeof (page as PublishedPage).title === 'string' &&
        typeof (page as PublishedPage).slug === 'string' &&
        typeof (page as PublishedPage).html === 'string',
      ),
    );
    if (pages.some((page) => page.slug === '')) return pages;
  } catch {
    // Older single-page publications fall back to their stored homepage.
  }
  return [{ title: fallbackTitle, slug: '', html: fallbackHtml }];
}

export function selectPublishedPage(pages: PublishedPage[], path: string) {
  const normalized = path.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (normalized && !pageSlugPattern.test(normalized)) return null;
  return pages.find((page) => page.slug === normalized) ?? null;
}

function rewriteSiteLinks(
  html: string,
  basePath: string,
  pages: PublishedPage[],
) {
  const knownPaths = new Set(pages.map((page) => page.slug));
  return html.replace(
    /\bhref=(['"])\/([^'"?#]*)([^'"]*)\1/gi,
    (match, quote: string, path: string, suffix: string) => {
      const normalized = path.replace(/^\/+|\/+$/g, '').toLowerCase();
      if (!knownPaths.has(normalized)) return match;
      const destination = normalized ? `${basePath}/${normalized}` : basePath;
      return `href=${quote}${destination}${suffix}${quote}`;
    },
  );
}

export function createPublishedSiteResponse(
  page: PublishedPage,
  pages: PublishedPage[],
  basePath = '',
) {
  const html = basePath
    ? rewriteSiteLinks(page.html, basePath, pages)
    : page.html;
  return new Response(html, {
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
