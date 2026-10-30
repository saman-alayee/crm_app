<script setup lang="ts">
const stripRef = ref<HTMLElement | null>(null);
useHorizontalDragScroll(stripRef);
</script>

<template>
  <div ref="stripRef" class="chip-strip">
    <slot />
  </div>
</template>
