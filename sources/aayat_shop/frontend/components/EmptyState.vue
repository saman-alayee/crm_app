<script setup lang="ts">
defineProps<{
  message?: string;
  icon?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 px-4">
    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
      <AppIcon :name="icon || 'lucide:inbox'" size="xl" class="text-gray-400" />
    </div>
    <p class="text-gray-500 text-sm">{{ message || 'موردی یافت نشد' }}</p>
    <slot />
  </div>
</template>
