<script setup lang="ts">
import { ANNOUNCEMENT_TEXT } from '~/constants/site';

const config = useRuntimeConfig();
const text = ref(ANNOUNCEMENT_TEXT);

onMounted(async () => {
  try {
    const apiBase = String(config.public.apiBase || '').replace(/\/+$/, '');
    const res = await $fetch<{ data?: { text?: string } }>(`${apiBase}/settings/announcement`);
    if (typeof res.data?.text === 'string') text.value = res.data.text.trim();
  } catch {
    text.value = ANNOUNCEMENT_TEXT;
  }
});
</script>

<template>
  <div v-if="text" class="bg-primary-800 text-white text-center text-xs md:text-sm py-2 px-4 tracking-wide">
    {{ text }}
  </div>
</template>
