<script setup lang="ts">
withDefaults(
  defineProps<{
    message?: string;
    variant?: 'error' | 'warning' | 'info';
  }>(),
  { variant: 'error' },
);

const classes: Record<string, string> = {
  error: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};
</script>

<template>
  <div
    v-if="message"
    :class="['whitespace-pre-line text-sm p-3 rounded-xl border leading-relaxed', classes[variant]]"
    role="alert"
  >
    {{ message }}
  </div>
</template>
