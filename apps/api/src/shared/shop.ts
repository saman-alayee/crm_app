export type Specs = Record<string, string | number | boolean | null | undefined>;

export function normalizeMobile(raw: string): string {
  let s = String(raw || '')
    .trim()
    .replace(/[\s\-()]/g, '')
    .replace(/^\+98/, '0')
    .replace(/^98/, '0');
  s = s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  if (/^9\d{9}$/.test(s)) s = `0${s}`;
  return s;
}

export function isValidIranMobile(mobile: string): boolean {
  return /^09\d{9}$/.test(normalizeMobile(mobile));
}

export function tehranDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function specsRecord(raw: unknown): Specs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Specs;
}

function norm(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const PHONE_EXACT = ['brand', 'model', 'storage', 'color', 'ram'] as const;
const PHONE_SIMILAR = ['brand', 'model'] as const;
const SIM_EXACT = ['operator', 'type', 'plan'] as const;
const SIM_SIMILAR = ['operator', 'type'] as const;

export function scoreSpecs(
  kind: 'PHONE' | 'SIM',
  a: Specs,
  b: Specs
): 'EXACT' | 'SIMILAR' | null {
  const exactKeys = kind === 'PHONE' ? PHONE_EXACT : SIM_EXACT;
  const similarKeys = kind === 'PHONE' ? PHONE_SIMILAR : SIM_SIMILAR;

  const exact = exactKeys.every((k) => {
    const av = norm(a[k]);
    const bv = norm(b[k]);
    if (!av && !bv) return true;
    return av && bv && av === bv;
  });
  if (exact && exactKeys.some((k) => norm(a[k]) || norm(b[k]))) return 'EXACT';

  const similar = similarKeys.every((k) => {
    const av = norm(a[k]);
    const bv = norm(b[k]);
    return av && bv && av === bv;
  });
  return similar ? 'SIMILAR' : null;
}

export function publicInventoryView(item: {
  id: string;
  productKind: string;
  specs: unknown;
  quantity: number;
  sellPrice?: unknown;
  note?: string | null;
}) {
  return {
    id: item.id,
    productKind: item.productKind,
    specs: specsRecord(item.specs),
    quantity: item.quantity,
    sellPrice: item.sellPrice != null ? String(item.sellPrice) : null,
    note: item.note || null,
  };
}

export function formatSpecsLabel(kind: string, specs: Specs): string {
  if (kind === 'SIM') {
    return [specs.operator, specs.type, specs.plan].filter(Boolean).join(' / ') || 'سیم‌کارت';
  }
  return [specs.brand, specs.model, specs.storage, specs.color].filter(Boolean).join(' / ') || 'گوشی';
}

export function buildDiffText(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>
): string {
  const lines: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    const label = labels[key] || key;
    lines.push(`${label}: ${fmt(b)} ← ${fmt(a)}`);
  }
  return lines.join('\n') || 'بدون تغییر معنادار';
}

function fmt(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export const DEFAULT_PRODUCT_OPTIONS: Array<{
  kind: 'PHONE' | 'SIM';
  category: string;
  value: string;
  sortOrder: number;
}> = [
  { kind: 'PHONE', category: 'brand', value: 'Apple', sortOrder: 1 },
  { kind: 'PHONE', category: 'brand', value: 'Samsung', sortOrder: 2 },
  { kind: 'PHONE', category: 'brand', value: 'Xiaomi', sortOrder: 3 },
  { kind: 'PHONE', category: 'storage', value: '128GB', sortOrder: 1 },
  { kind: 'PHONE', category: 'storage', value: '256GB', sortOrder: 2 },
  { kind: 'PHONE', category: 'storage', value: '512GB', sortOrder: 3 },
  { kind: 'PHONE', category: 'color', value: 'مشکی', sortOrder: 1 },
  { kind: 'PHONE', category: 'color', value: 'سفید', sortOrder: 2 },
  { kind: 'PHONE', category: 'color', value: 'آبی', sortOrder: 3 },
  { kind: 'SIM', category: 'operator', value: 'همراه‌اول', sortOrder: 1 },
  { kind: 'SIM', category: 'operator', value: 'ایرانسل', sortOrder: 2 },
  { kind: 'SIM', category: 'operator', value: 'رایتل', sortOrder: 3 },
  { kind: 'SIM', category: 'type', value: 'دائمی', sortOrder: 1 },
  { kind: 'SIM', category: 'type', value: 'اعتباری', sortOrder: 2 },
  { kind: 'SIM', category: 'plan', value: 'عادی', sortOrder: 1 },
  { kind: 'SIM', category: 'plan', value: 'رند', sortOrder: 2 },
];

export const DEFAULT_ACQUISITION_SOURCES = [
  'حضوری',
  'تلفنی',
  'اینستاگرام',
  'تلگرام',
  'معرفی دوستان',
  'سایت',
  'سایر',
];
