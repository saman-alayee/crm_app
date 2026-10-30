type SitemapEntry = { loc: string; lastmod?: string };

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const base = ((config.public.siteUrl as string) || '').replace(/\/+$/, '');
  const apiBase = (config.public.apiBase as string).replace(/\/+$/, '');

  const staticPaths = ['/', '/categories', '/contact'];
  const entries: SitemapEntry[] = staticPaths.map((path) => ({ loc: `${base}${path}` }));

  try {
    const [categoriesRes, productsRes] = await Promise.all([
      $fetch<{ data: { slug: string; updatedAt?: string }[] }>(`${apiBase}/categories`),
      $fetch<{ data: { products: { slug: string; updatedAt?: string }[] } }>(
        `${apiBase}/products?limit=500&page=1`
      ),
    ]);

    for (const cat of categoriesRes.data ?? []) {
      entries.push({
        loc: `${base}/categories/${cat.slug}`,
        lastmod: cat.updatedAt,
      });
    }
    for (const product of productsRes.data?.products ?? []) {
      entries.push({
        loc: `${base}/products/${product.slug}`,
        lastmod: product.updatedAt,
      });
    }
  } catch {
    // Sitemap still returns static URLs if API is unavailable during build
  }

  const body = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>` : '';
      return `<url><loc>${xmlEscape(entry.loc)}</loc>${lastmod}</url>`;
    })
    .join('');

  setHeader(event, 'content-type', 'application/xml; charset=utf-8');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
});
