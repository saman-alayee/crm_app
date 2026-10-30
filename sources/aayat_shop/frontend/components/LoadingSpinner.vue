<script setup lang="ts">
defineProps<{
  show?: boolean;
}>();
</script>

<template>
  <div v-if="show" class="flex items-center justify-center py-12">
    <AppIcon name="lucide:loader-2" size="xl" class="text-primary-600 animate-spin" />
  </div>
</template>
