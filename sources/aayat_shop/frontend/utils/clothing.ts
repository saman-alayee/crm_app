import type { ClothingMeta, Product } from '~/types';

export function parseClothingMeta(product: Product): ClothingMeta | null {
  const raw = product.clothingMeta;
  if (!raw || typeof raw !== 'object') return null;
  return raw as ClothingMeta;
}

export function variantStock(meta: ClothingMeta | null, color?: string, size?: string): number | null {
  if (!meta?.variants?.length) return null;
  const match = meta.variants.find(
    (v) => (!color || v.color === color) && (!size || v.size === size)
  );
  if (match) return match.stock;
  if (color && size) {
    const partial = meta.variants.find((v) => v.color === color && v.size === size);
    return partial?.stock ?? 0;
  }
  return null;
}

export function effectiveProductStock(product: Product, color?: string, size?: string): number {
  const meta = parseClothingMeta(product);
  const fromVariant = variantStock(meta, color, size);
  if (fromVariant !== null) return fromVariant;
  return product.stock;
}

export function colorSwatchStyle(hex?: string) {
  if (!hex) return { backgroundColor: '#e5e7eb' };
  return { backgroundColor: hex };
}
