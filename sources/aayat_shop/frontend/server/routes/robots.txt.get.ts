export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  const base = (config.public.siteUrl as string) || '';
  setHeader(event, 'content-type', 'text/plain; charset=utf-8');
  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /profile
Disallow: /checkout
Disallow: /cart
Disallow: /auth
Disallow: /orders
Disallow: /maintenance

Sitemap: ${base}/sitemap.xml
`;
});
