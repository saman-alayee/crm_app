import type { Category } from '~/types';
import { sortNavRoots } from '~/constants/categoryNav';
import wpCategoryParents from '~/constants/wpCategoryParents.json';

const parentSlugByChild = wpCategoryParents as Record<string, string | null>;

export function useCategoryNavTree(categories: Ref<Category[] | null | undefined>) {
  const slugToCategory = computed(() => {
    const map = new Map<string, Category>();
    for (const c of categories.value ?? []) {
      map.set(c.slug, c);
    }
    return map;
  });

  function parentSlug(slug: string): string | null {
    const cat = slugToCategory.value.get(slug);
    if (cat?.parentId) {
      const parent = (categories.value ?? []).find((c) => c.id === cat.parentId);
      return parent?.slug ?? parentSlugByChild[slug] ?? null;
    }
    return parentSlugByChild[slug] ?? null;
  }

  const roots = computed(() => {
    const list = (categories.value ?? []).filter((c) => {
      if (!c.isActive) return false;
      return parentSlug(c.slug) === null;
    });
    return sortNavRoots(list);
  });

  function childrenOf(rootSlug: string): Category[] {
    return (categories.value ?? [])
      .filter((c) => c.isActive && parentSlug(c.slug) === rootSlug)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fa'));
  }

  function defaultRootSlug(): string | null {
    return roots.value[0]?.slug ?? null;
  }

  return { slugToCategory, roots, childrenOf, defaultRootSlug, parentSlug };
}
