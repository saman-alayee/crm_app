<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';

definePageMeta({ layout: false });

const route = useRoute();
const authStore = useAuthStore();
const gate = useMaintenanceGate();

const preview = computed(() => route.query.preview === '1');
const description = computed(() => gate.message.value);

const status = await gate.fetchStatus(true);

let pollTimer: ReturnType<typeof setInterval> | null = null;

watch(
  () => gate.enabled.value,
  (on) => {
    if (preview.value) return;
    if (!on && !gate.canBypassMaintenance()) {
      navigateTo('/', { replace: true });
    }
  },
);

onMounted(() => {
  authStore.init();

  if (!preview.value && !status.enabled && !gate.canBypassMaintenance()) {
    navigateTo('/', { replace: true });
    return;
  }

  pollTimer = setInterval(async () => {
    if (preview.value || gate.canBypassMaintenance()) return;
    const next = await gate.fetchStatus(true);
    if (!next.enabled) {
      navigateTo('/', { replace: true });
    }
  }, 12_000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});

useHead({
  title: `تعمیر فروشگاه - ${SITE_NAME}`,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

if (import.meta.server && status.enabled && !preview.value) {
  const event = useRequestEvent();
  if (event) setResponseStatus(event, 503);
}
</script>

<template>
  <MaintenanceFashionScene :description="description" :preview="preview">
    <template #brand>
      <div class="mb-8 inline-flex items-center gap-2 opacity-90">
        <img
          src="/logo.png"
          :alt="SITE_NAME"
          class="h-11 w-11 rounded-full object-cover ring-1 ring-primary-200/80"
          width="44"
          height="44"
        />
        <span class="text-sm font-semibold tracking-wide text-primary-900">{{ SITE_NAME }}</span>
      </div>
    </template>

    <div v-if="authStore.isAdmin" class="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <NuxtLink to="/admin/settings" class="btn-primary btn-action min-w-[10rem]">
        تنظیمات تعمیر
      </NuxtLink>
      <NuxtLink to="/" class="btn-secondary btn-action min-w-[10rem]">
        مشاهده فروشگاه (ادمین)
      </NuxtLink>
    </div>
  </MaintenanceFashionScene>
</template>
