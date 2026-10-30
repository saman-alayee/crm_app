<script setup lang="ts">
import type { Category } from '~/types';

withDefaults(
  defineProps<{
    category: Category;
    active?: boolean;
    size?: 'md' | 'lg';
  }>(),
  {
    active: false,
    size: 'lg',
  }
);

const { getCategoryImage } = useFormat();

const sizeClasses = {
  md: {
    wrap: 'min-w-[72px]',
    box: 'w-[72px] h-[72px] rounded-2xl',
    text: 'text-xs',
  },
  lg: {
    wrap: 'min-w-[80px]',
    box: 'w-[80px] h-[80px] rounded-2xl',
    text: 'text-xs',
  },
};
</script>

<template>
  <NuxtLink
    :to="`/categories/${category.slug}`"
    :class="['flex flex-col items-center gap-1.5 cursor-pointer group shrink-0', sizeClasses[size].wrap]"
    draggable="false"
  >
    <div
      :class="[
        sizeClasses[size].box,
        'overflow-hidden transition-transform',
        active ? 'ring-2 ring-primary-400' : 'group-hover:scale-105 group-active:scale-95',
      ]"
    >
      <img
        v-if="category.image"
        :src="getCategoryImage(category.image)"
        :alt="category.name"
        class="pointer-events-none h-full w-full object-cover"
        draggable="false"
      />
      <span v-else class="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400">
        <AppIcon name="lucide:shirt" size="xl" />
      </span>
    </div>
    <span
      :class="[
        sizeClasses[size].text,
        'font-semibold text-center leading-tight px-1',
        active ? 'text-primary-600' : 'text-gray-700',
      ]"
    >
      {{ category.name }}
    </span>
  </NuxtLink>
</template>
