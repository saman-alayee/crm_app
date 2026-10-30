import type { Product } from '~/types';
import { resolveMediaUrl } from '~/utils/mediaUrl';

/** همیشه در public موجود است (برخلاف jpg قدیمی). */
export const PRODUCT_IMAGE_PLACEHOLDER = '/images/placeholder-product.svg';

/** تصاویر دمو — SVG محلی از سرور Nuxt (fallback اگر URL خارجی لود نشود). */
export function demoMediaUrl(key: string, width = 534, height = 800): string {
  const safe = key.replace(/[^a-zA-Z0-9-_]/g, '-');
  return `/demo-img/${safe}?w=${width}&h=${height}`;
}

/** عدد پایدار از کلید — همان عکس برای همان lock در loremflickr. */
function loremFlickrLock(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return (hash % 9999) + 1;
}

/** تصاویر placeholder از loremflickr.com (پوشاک / فشن). */
export function loremFlickrPhotoUrl(
  key: string,
  width = 534,
  height = 800,
  tags = 'fashion,clothing'
): string {
  const w = Math.min(1920, Math.max(100, Math.round(width)));
  const h = Math.min(1920, Math.max(100, Math.round(height)));
  const tagPath = tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .join(',');
  const lock = loremFlickrLock(key);
  const remote = `https://loremflickr.com/${w}/${h}/${tagPath}?lock=${lock}`;
  return `/demo-proxy?target=${encodeURIComponent(remote)}`;
}

/** عکس لورم افقی برای هیرو — picsum (پایدارتر از loremflickr). */
export function picsumPhotoUrl(id: number, width = 1600, height = 900): string {
  const remote = `https://picsum.photos/id/${id}/${width}/${height}`;
  return `/demo-proxy?target=${encodeURIComponent(remote)}`;
}

export function collectProductImagePaths(product: Product): string[] {
  const out: string[] = [];
  const push = (raw: string | null | undefined) => {
    if (!raw) return;
    const url = resolveMediaUrl(raw);
    if (!out.includes(url)) out.push(url);
  };
  push(product.image);
  for (const img of product.images ?? []) push(img);
  return out;
}

export function primaryProductImageUrl(product: Product): string {
  const paths = collectProductImagePaths(product);
  const first = paths[0];
  if (!first) return PRODUCT_IMAGE_PLACEHOLDER;
  if (first.startsWith('/demo-img/') || first.startsWith('/demo-proxy')) {
    return PRODUCT_IMAGE_PLACEHOLDER;
  }
  if (first.startsWith('/uploads/') || first.startsWith('/images/') || first.startsWith('http')) {
    return first.startsWith('/uploads/') ? resolveMediaUrl(first) : first;
  }
  return PRODUCT_IMAGE_PLACEHOLDER;
}

/** تصویر دوم برای هاور — فقط گالری واقعی؛ برای تک‌عکس null. */
export function hoverProductImageUrl(product: Product): string | null {
  const paths = collectProductImagePaths(product);
  if (paths.length < 2) return null;
  const second = paths[1];
  if (!second || second === paths[0]) return null;
  if (second.startsWith('/demo-img/') || second.startsWith('/demo-proxy')) return null;
  return second.startsWith('/uploads/') ? resolveMediaUrl(second) : second;
}
