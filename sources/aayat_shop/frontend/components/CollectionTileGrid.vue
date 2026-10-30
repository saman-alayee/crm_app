<script setup lang="ts">
import type { Category } from '~/types';

defineProps<{
  categories: Category[];
}>();

const { getCategoryImage } = useFormat();

/** برچسب کوتاه روی کاشی — مشابه «مردانه / زنانه» */
function tileLabel(name: string) {
  if (name.includes('زنانه') && !name.includes('دختر')) return 'زنانه';
  if (name.includes('مردانه')) return 'مردانه';
  if (name.includes('دختر')) return 'دخترانه';
  if (name.includes('پسر')) return 'پسرانه';
  return name;
}
</script>

<template>
  <section v-if="categories.length" class="grid grid-cols-2 w-full">
    <NuxtLink
      v-for="category in categories.slice(0, 4)"
      :key="category.id"
      :to="`/categories/${category.slug}`"
      class="group relative aspect-square overflow-hidden bg-neutral-100"
    >
      <img
        v-if="category.image"
        :src="getCategoryImage(category.image)"
        :alt="category.name"
        class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <div class="absolute inset-0 bg-black/15 group-hover:bg-black/20 transition-colors" />
      <div class="absolute inset-x-0 bottom-0 p-4 md:p-6 text-white">
        <p class="text-[10px] md:text-xs tracking-[0.2em] uppercase opacity-90 mb-1">کالکشن</p>
        <p class="text-lg md:text-2xl font-medium tracking-wide">{{ tileLabel(category.name) }}</p>
      </div>
    </NuxtLink>
  </section>
</template>
