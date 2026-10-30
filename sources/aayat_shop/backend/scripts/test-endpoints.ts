/**
 * Smoke-test all API endpoints. Run: npm run test:endpoints
 * Expects backend on http://127.0.0.1:3001
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:3001/api';

type Result = { method: string; path: string; status: number; ok: boolean; note?: string };

const results: Result[] = [];

async function req(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; sessionId?: string; expect?: number[] } = {}
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.sessionId) headers['X-Session-ID'] = opts.sessionId;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  let json: Record<string, unknown> | null = null;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = null;
  }

  const expect = opts.expect ?? [200, 201];
  const ok = expect.includes(res.status);
  results.push({
    method,
    path,
    status: res.status,
    ok,
    note: ok ? undefined : String(json?.message ?? res.statusText),
  });

  return { status: res.status, json };
}

async function loginAdmin() {
  const { json } = await req('POST', '/auth/admin/login-password', {
    body: { phone: '09120000000', password: 'admin1234' },
    expect: [200],
  });
  return (json?.data as { token?: string })?.token ?? '';
}

async function loginCustomer() {
  await req('POST', '/auth/send-otp', {
    body: { phone: '09121111111' },
    expect: [200],
  });
  const { json } = await req('POST', '/auth/verify-otp', {
    body: { phone: '09121111111', code: '123456' },
    expect: [200],
  });
  return (json?.data as { token?: string })?.token ?? '';
}

async function main() {
  console.log('Testing API at', BASE);

  // --- Public GET ---
  await req('GET', '/health', { expect: [200] });
  await req('GET', '/categories');
  await req('GET', '/categories/woman-clothe', { expect: [200, 404] });
  await req('GET', '/products?limit=5');
  await req('GET', '/products/home');
  await req('GET', '/products/home-feed');
  await req('GET', '/sliders');
  await req('GET', '/sliders?placement=HOME_TOP');
  await req('GET', '/sliders?placement=HOME_MID');
  await req('GET', '/tags');
  await req('GET', '/content/terms', { expect: [200, 404] });
  await req('GET', '/cart', { expect: [200] });

  const products = await req('GET', '/products?limit=1');
  const productList = (products.json?.data as { products?: { slug: string }[] })?.products;
  const slug = productList?.[0]?.slug;
  if (slug) {
    await req('GET', `/products/${slug}`);
    await req('GET', `/products/${slug}/related?limit=4`);
  } else {
    results.push({ method: 'GET', path: '/products/:slug', status: 0, ok: false, note: 'no products in DB' });
  }

  const tags = await req('GET', '/tags');
  const tagSlug = (tags.json?.data as { slug?: string }[])?.[0]?.slug;
  if (tagSlug) {
    await req('GET', `/tags/${tagSlug}/products?limit=5`, { expect: [200, 404] });
  }

  // --- Auth ---
  await req('POST', '/auth/send-otp', { body: { phone: '09129999999' }, expect: [200] });
  await req('POST', '/auth/admin/login-password', {
    body: { phone: '09120000000', password: 'wrong' },
    expect: [401],
  });

  const adminToken = await loginAdmin();
  const customerToken = await loginCustomer();

  if (!adminToken) {
    console.error('Admin login failed — skipping admin tests');
  } else {
    await req('GET', '/auth/profile', { token: adminToken });

    // Admin GETs
    const adminGets = [
      '/admin/stats',
      '/admin/products?limit=5',
      '/admin/categories',
      '/admin/tags',
      '/admin/sliders',
      '/admin/orders?limit=5',
      '/admin/customers?limit=5',
      '/admin/customer-groups',
      '/admin/coupons',
      '/admin/content',
      '/admin/sales/overview',
      '/admin/users?limit=5',
      '/admin/access-roles',
      '/admin/settings/new-order-sms',
    ];
    for (const p of adminGets) {
      await req('GET', p, { token: adminToken });
    }
  }

  if (!customerToken) {
    console.error('Customer login failed — skipping customer auth tests');
  } else {
    await req('GET', '/auth/profile', { token: customerToken });
    await req('GET', '/favorites', { token: customerToken });
    await req('GET', '/notifications', { token: customerToken });
    await req('GET', '/addresses', { token: customerToken });
    await req('GET', '/orders', { token: customerToken });
    await req('GET', '/cart', { token: customerToken });
  }

  // Coupon validate (public POST)
  await req('POST', '/coupons/validate', {
    body: { code: 'INVALID', subtotal: 100000 },
    expect: [200, 400, 404],
  });

  // Summary
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);

  console.log('\n=== PASSED:', passed.length, '===');
  for (const r of passed) {
    console.log(`  OK  ${r.method.padEnd(6)} ${r.path} (${r.status})`);
  }

  if (failed.length) {
    console.log('\n=== FAILED:', failed.length, '===');
    for (const r of failed) {
      console.log(`  FAIL ${r.method.padEnd(6)} ${r.path} (${r.status}) ${r.note ?? ''}`);
    }
    process.exit(1);
  }

  console.log('\nAll endpoint smoke tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
