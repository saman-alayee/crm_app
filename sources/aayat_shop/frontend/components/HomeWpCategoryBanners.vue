<script setup lang="ts">
import type { Category } from '~/types';
import { HOME_CATEGORY_TILES } from '~/constants/homeCategoryTiles';

const api = useApi();
const { getCategoryImage } = useFormat();

const categories = ref<Category[]>([]);
const loaded = ref(false);

/** Always show the homepage tiles; enrich from API when available. */
const tiles = computed(() => {
  const bySlug = new Map((categories.value || []).map((category) => [category.slug, category]));
  return HOME_CATEGORY_TILES.map((tile) => {
    const category = bySlug.get(tile.slug);
    return {
      slug: tile.slug,
      name: category?.name || tile.label,
      image: category?.image?.trim() || tile.fallbackImage,
    };
  });
});

onMounted(async () => {
  try {
    const { data } = await api.get<Category[]>('/categories?lite=1');
    categories.value = Array.isArray(data) ? data : [];
  } catch {
    categories.value = [];
  } finally {
    loaded.value = true;
  }
});
</script>

<template>
  <section
    class="grid grid-cols-2 gap-3 px-4 py-5 md:grid-cols-3 md:gap-4 md:px-6 md:py-8"
    :aria-busy="!loaded"
  >
    <NuxtLink
      v-for="tile in tiles"
      :key="tile.slug"
      :to="`/categories/${tile.slug}`"
      :aria-label="tile.name"
      class="relative flex h-28 items-center justify-center overflow-hidden rounded-[1.6rem] bg-[#f7f1e8] ring-1 ring-[#e4d5c4] transition-colors hover:bg-[#f3ebdf] md:h-36"
    >
      <img
        :src="getCategoryImage(tile.image)"
        :alt="tile.name"
        class="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </NuxtLink>
  </section>
</template>
