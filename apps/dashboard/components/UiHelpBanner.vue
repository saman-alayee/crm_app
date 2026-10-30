<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** کلید یکتا برای به‌خاطر سپردن بستن راهنما */
    storageKey: string;
    title?: string;
    steps?: string[];
    tone?: 'info' | 'tip' | 'warn';
    /** اگر true باشد، بعد از بستن دیگر نشان داده نمی‌شود */
    dismissible?: boolean;
  }>(),
  {
    title: 'راهنمای سریع',
    tone: 'info',
    dismissible: true,
    steps: () => [],
  },
);

const hidden = ref(false);

onMounted(() => {
  if (!import.meta.client || !props.dismissible) return;
  try {
    if (localStorage.getItem(`hr-help:${props.storageKey}`) === '1') {
      hidden.value = true;
    }
  } catch {
    /* ignore */
  }
});

function dismiss() {
  hidden.value = true;
  if (!import.meta.client || !props.dismissible) return;
  try {
    localStorage.setItem(`hr-help:${props.storageKey}`, '1');
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div v-if="!hidden" class="help-banner" :class="`help-banner--${tone}`" role="note">
    <div class="help-banner__icon" aria-hidden="true">
      <AppIcon
        :name="tone === 'warn' ? 'lucide:triangle-alert' : tone === 'tip' ? 'lucide:lightbulb' : 'lucide:circle-help'"
        size="md"
      />
    </div>
    <div class="help-banner__body">
      <p class="help-banner__title">{{ title }}</p>
      <p v-if="$slots.default" class="help-banner__text">
        <slot />
      </p>
      <ol v-if="steps.length" class="help-banner__steps">
        <li v-for="(step, i) in steps" :key="i">{{ step }}</li>
      </ol>
    </div>
    <button
      v-if="dismissible"
      class="btn-icon help-banner__close"
      type="button"
      title="متوجه شدم"
      @click="dismiss"
    >
      <AppIcon name="lucide:x" size="sm" />
    </button>
  </div>
</template>
