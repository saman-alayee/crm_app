const ALLOWED = /^https:\/\/(loremflickr\.com|picsum\.photos)\//;

export default defineEventHandler(async (event) => {
  const raw = getQuery(event).target;
  const target = typeof raw === 'string' ? raw : '';
  if (!target || !ALLOWED.test(target)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid demo image target' });
  }

  let response: Response;
  try {
    response = await fetch(target, {
      headers: {
        'User-Agent': 'AayatShop-Demo/1.0',
        Accept: 'image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Demo image fetch failed' });
  }

  if (!response.ok) {
    throw createError({ statusCode: 502, statusMessage: `Upstream ${response.status}` });
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  setHeader(event, 'Content-Type', contentType);
  setHeader(event, 'Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
});
