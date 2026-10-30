<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';

withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg';
    link?: boolean;
  }>(),
  {
    size: 'md',
    link: true,
  },
);

const imgClass = {
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-14 w-14',
};
</script>

<template>
  <NuxtLink
    v-if="link"
    to="/"
    class="inline-flex items-center shrink-0 relative z-10 cursor-pointer hover:opacity-90 transition-opacity"
    :aria-label="`صفحه اصلی ${SITE_NAME}`"
  >
    <img src="/logo.png" :class="[imgClass[size], 'rounded-full object-cover']" :alt="SITE_NAME" width="64" height="64" decoding="async" />
  </NuxtLink>
  <div v-else class="inline-flex items-center shrink-0">
    <img src="/logo.png" :class="[imgClass[size], 'rounded-full object-cover']" :alt="SITE_NAME" width="64" height="64" decoding="async" />
  </div>
</template>
