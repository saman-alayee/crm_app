<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    to?: string;
    linkLabel?: string;
  }>(),
  { linkLabel: 'مشاهده بیشتر' }
);
</script>

<template>
  <div class="flex items-center justify-between gap-4 mb-4 md:mb-5 px-5 md:px-8 lg:px-10">
    <h2 class="text-sm md:text-base font-semibold text-primary-900 tracking-tight">{{ title }}</h2>
    <NuxtLink
      v-if="to"
      :to="to"
      class="shrink-0 text-xs md:text-sm text-primary-700 hover:text-primary-900 inline-flex items-center gap-0.5 border-b border-transparent hover:border-primary-400 pb-px transition-colors"
    >
      {{ linkLabel }}
    </NuxtLink>
  </div>
</template>
