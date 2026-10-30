<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    class?: string;
  }>(),
  { size: 'md' }
);

const sizeClass: Record<string, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};
</script>

<template>
  <Icon :name="name" :class="[sizeClass[size], $props.class]" />
</template>
