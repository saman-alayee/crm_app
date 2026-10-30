<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
  backTo?: string;
}>();
</script>

<template>
  <div class="flex items-center gap-3 mb-5">
    <NuxtLink
      v-if="backTo"
      :to="backTo"
      class="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-50 shrink-0"
    >
      <AppIcon name="lucide:arrow-right" size="md" />
    </NuxtLink>
    <div class="min-w-0 flex-1">
      <h1 class="text-lg font-bold text-gray-800">{{ title }}</h1>
      <p v-if="subtitle" class="text-sm text-gray-500 mt-0.5">{{ subtitle }}</p>
    </div>
    <div class="ms-auto shrink-0">
      <slot name="action" />
    </div>
  </div>
</template>
