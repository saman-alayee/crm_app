import { getCurrentInstance } from 'vue';

function apiOriginFromEnv(): string {
  const raw = (import.meta.env.NUXT_PUBLIC_API_BASE as string | undefined)?.trim();
  const base = raw || 'http://localhost:3001/api';
  if (base.startsWith('/')) {
    return '';
  }
  return base.replace(/\/api\/?$/, '');
}

/** Base URL for `/uploads/*` (works outside Vue setup). */
export function getApiOrigin(): string {
  if (getCurrentInstance()) {
    try {
      const config = useRuntimeConfig();
      return config.public.apiBase.replace(/\/api\/?$/, '');
    } catch {
      /* fall through */
    }
  }
  return apiOriginFromEnv();
}

export function resolveMediaUrl(image: string): string {
  if (!image) return image;
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads/')) {
    const origin = getApiOrigin();
    return origin ? `${origin}${image}` : image;
  }
  return image;
}

export function getProductImage(image: string | null): string {
  if (!image) return '/images/placeholder-product.svg';
  return resolveMediaUrl(image);
}

export function getCategoryImage(image: string | null): string {
  if (!image) return '/images/placeholder-product.svg';
  return resolveMediaUrl(image);
}
