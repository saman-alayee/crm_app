<script setup lang="ts">
defineProps<{
  text?: string;
}>();
</script>

<template>
  <p class="field-hint">
    <slot>{{ text }}</slot>
  </p>
</template>
