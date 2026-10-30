<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    message?: string;
    tip?: string;
    icon?: string;
    /** وقتی داخل کارت دیگر است، حاشیه تکراری نگذارد */
    plain?: boolean;
  }>(),
  {
    title: '',
    message: 'موردی یافت نشد',
    tip: '',
    icon: 'lucide:inbox',
    plain: false,
  },
);
</script>

<template>
  <div class="empty-state" :class="{ 'empty-state--plain': plain }">
    <div class="empty-state__icon" aria-hidden="true">
      <AppIcon :name="icon" size="xl" />
    </div>
    <p v-if="title" class="empty-state__title">{{ title }}</p>
    <p class="empty-state__message">{{ message }}</p>
    <p v-if="tip" class="empty-state__tip">{{ tip }}</p>
    <div v-if="$slots.default" class="empty-state__actions">
      <slot />
    </div>
  </div>
</template>
