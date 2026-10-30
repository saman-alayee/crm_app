<script setup lang="ts">
withDefaults(
  defineProps<{
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hover?: boolean;
  }>(),
  { padding: 'md', hover: false }
);

const padClass: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5 sm:p-6',
};
</script>

<template>
  <div class="card" :class="[padClass[padding], hover ? 'hover-soft' : '']">
    <div v-if="$slots.header" class="mb-3 flex items-center justify-between gap-3">
      <slot name="header" />
    </div>
    <slot />
    <div v-if="$slots.footer" class="mt-4 border-t pt-3" style="border-color: var(--hr-border)">
      <slot name="footer" />
    </div>
  </div>
</template>
