/** دسته‌هایی که روی صفحه اول به‌صورت کارت تصویر نمایش داده می‌شوند. */
export const HOME_CATEGORY_TILES = [
  { slug: 't-shirt', label: 'تیشرت', fallbackImage: '/wp-home/categories/tshirt.png' },
  { slug: 'paperbacks-and-shirts', label: 'شومیز و پیراهن', fallbackImage: '/wp-home/categories/blouse.png' },
  { slug: 'pants', label: 'شلوار', fallbackImage: '/wp-home/categories/pants.png' },
  { slug: 'overalls', label: 'اوورال', fallbackImage: '/wp-home/categories/overalls.png' },
  { slug: 'knitted-blouse', label: 'بلوز بافت', fallbackImage: '/wp-home/categories/knitted-blouse.png' },
  { slug: 'beach-shirt', label: 'پیراهن ساحلی', fallbackImage: '/wp-home/categories/dress.png' },
  { slug: 'coat', label: 'کت', fallbackImage: '/wp-home/categories/coat.png' },
] as const;

export const HOME_CATEGORY_SLUGS = new Set(HOME_CATEGORY_TILES.map((tile) => tile.slug));

export function isHomeCategorySlug(slug: string): boolean {
  return (HOME_CATEGORY_SLUGS as Set<string>).has(slug);
}
