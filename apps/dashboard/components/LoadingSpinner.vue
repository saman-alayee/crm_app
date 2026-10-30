<script setup lang="ts">
withDefaults(
  defineProps<{
    show?: boolean;
    label?: string;
    compact?: boolean;
  }>(),
  {
    show: true,
    label: 'در حال بارگذاری…',
    compact: false,
  }
);
</script>

<template>
  <div
    v-if="show !== false"
    class="hr-loader"
    :class="compact ? 'hr-loader--compact' : 'hr-loader--full'"
    role="status"
    aria-live="polite"
  >
    <div class="hr-loader__orbit" aria-hidden="true">
      <span class="hr-loader__ring" />
      <span class="hr-loader__dot" />
      <span class="hr-loader__pulse" />
    </div>
    <p v-if="!compact" class="hr-loader__label">{{ label }}</p>
  </div>
</template>
