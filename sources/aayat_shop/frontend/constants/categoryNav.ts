import type { Category } from '~/types';

/** ترتیب ریشه‌های منو (در صورت وجود در API) */
export const NAV_ROOT_SLUG_ORDER = [
  'woman-clothe',
  'dokhtarane',
  'pesarane',
  'mardane',
  'girl',
  'boy',
  'man',
];

const NAV_LABELS: Record<string, string> = {
  'woman-clothe': 'زنانه',
};

export function navCategoryLabel(category: Pick<Category, 'slug' | 'name'>): string {
  return NAV_LABELS[category.slug] ?? category.name;
}

export function sortNavRoots(roots: Category[]): Category[] {
  return [...roots].sort((a, b) => {
    const ia = NAV_ROOT_SLUG_ORDER.indexOf(a.slug);
    const ib = NAV_ROOT_SLUG_ORDER.indexOf(b.slug);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.sortOrder - b.sortOrder;
  });
}
