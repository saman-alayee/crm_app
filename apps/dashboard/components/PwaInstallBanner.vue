<script setup lang="ts">
const INSTALL_DISMISS_KEY = 'hr-pwa-install-dismissed-until';
const UPDATE_DISMISS_KEY = 'hr-pwa-update-dismissed-until';
const INSTALL_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 60; // 60 days
const UPDATE_COOLDOWN_MS = 1000 * 60 * 60 * 12; // 12 hours
const SHOW_DELAY_MS = 8_000;

const { $pwa } = useNuxtApp();

const standalone = ref(false);
const isIosSafari = ref(false);
const readyToShow = ref(false);
const closed = ref(false);

type BannerMode = 'update' | 'install' | 'ios';
const mode = ref<BannerMode | null>(null);

let delayTimer = 0;
let stopWatch: (() => void) | null = null;
let mq: MediaQueryList | null = null;

function readUntil(key: string): number {
  if (!import.meta.client) return 0;
  try {
    const n = Number(localStorage.getItem(key) || 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function isCoolingDown(key: string): boolean {
  return Date.now() < readUntil(key);
}

function persistUntil(key: string, ms: number) {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(key, String(Date.now() + ms));
  } catch {
    /* private mode / quota */
  }
}

function resolveMode(): BannerMode | null {
  if (!import.meta.client || standalone.value || closed.value) return null;
  if ($pwa?.needRefresh && !isCoolingDown(UPDATE_DISMISS_KEY)) return 'update';
  if (isCoolingDown(INSTALL_DISMISS_KEY)) return null;
  if ($pwa?.showInstallPrompt) return 'install';
  if (isIosSafari.value && !$pwa?.isPWAInstalled) return 'ios';
  return null;
}

function refreshVisibility() {
  if (closed.value) {
    mode.value = null;
    return;
  }
  mode.value = resolveMode();
}

function onDisplayModeChange() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  standalone.value = Boolean(mq?.matches || nav.standalone || $pwa?.isPWAInstalled);
  if (standalone.value) {
    closed.value = true;
    mode.value = null;
  }
}

onMounted(() => {
  if (!import.meta.client) return;

  mq = window.matchMedia('(display-mode: standalone)');
  const nav = window.navigator as Navigator & { standalone?: boolean };
  standalone.value = mq.matches || nav.standalone === true || Boolean($pwa?.isPWAInstalled);

  const ua = window.navigator.userAgent;
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Android/i.test(ua);
  isIosSafari.value = isAppleMobile && isSafari && nav.standalone !== true;

  if (standalone.value) {
    closed.value = true;
    return;
  }

  mq.addEventListener?.('change', onDisplayModeChange);

  delayTimer = window.setTimeout(() => {
    readyToShow.value = true;
    refreshVisibility();
  }, SHOW_DELAY_MS);

  stopWatch = watch(
    () => [$pwa?.needRefresh, $pwa?.showInstallPrompt, $pwa?.isPWAInstalled] as const,
    () => {
      if ($pwa?.isPWAInstalled) {
        standalone.value = true;
        closed.value = true;
        mode.value = null;
        return;
      }
      if (readyToShow.value && !closed.value) refreshVisibility();
    },
  );
});

onUnmounted(() => {
  if (delayTimer) window.clearTimeout(delayTimer);
  mq?.removeEventListener?.('change', onDisplayModeChange);
  stopWatch?.();
});

const visible = computed(
  () => readyToShow.value && !closed.value && mode.value !== null,
);

async function install() {
  if (mode.value === 'update') {
    await $pwa?.updateServiceWorker(true);
    return;
  }
  if (mode.value === 'install') {
    await $pwa?.install();
    closed.value = true;
    mode.value = null;
    persistUntil(INSTALL_DISMISS_KEY, INSTALL_COOLDOWN_MS);
    $pwa?.cancelInstall?.();
  }
}

function dismiss() {
  const current = mode.value;
  closed.value = true;
  mode.value = null;

  if (current === 'update') {
    persistUntil(UPDATE_DISMISS_KEY, UPDATE_COOLDOWN_MS);
    void $pwa?.cancelPrompt?.();
  } else {
    persistUntil(INSTALL_DISMISS_KEY, INSTALL_COOLDOWN_MS);
    $pwa?.cancelInstall?.();
    void $pwa?.cancelPrompt?.();
  }
}
</script>

<template>
  <Transition name="pwa-banner">
    <div v-if="visible" class="pwa-banner" role="status">
      <div class="pwa-banner__icon">
        <img src="/pwa/icon-192.png" alt="" width="40" height="40" />
      </div>
      <div class="pwa-banner__text">
        <p class="pwa-banner__title">
          <template v-if="mode === 'update'">نسخه جدید آماده است</template>
          <template v-else-if="mode === 'install'">نصب اپ روی گوشی</template>
          <template v-else>افزودن به صفحه اصلی</template>
        </p>
        <p class="pwa-banner__desc">
          <template v-if="mode === 'update'">برای دریافت آخرین امکانات، به‌روزرسانی کنید</template>
          <template v-else-if="mode === 'install'">مثل اپ واقعی — بدون فروشگاه</template>
          <template v-else>در Safari: دکمه Share سپس Add to Home Screen</template>
        </p>
      </div>
      <div class="pwa-banner__actions">
        <button
          v-if="mode !== 'ios'"
          class="btn-soft !py-1.5 !text-xs"
          type="button"
          @click="install"
        >
          {{ mode === 'update' ? 'به‌روزرسانی' : 'نصب' }}
        </button>
        <button class="btn-icon" type="button" title="بستن" @click.stop.prevent="dismiss">
          <AppIcon name="lucide:x" size="sm" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-banner {
  position: fixed;
  z-index: 60;
  inset-inline: 0.75rem;
  bottom: calc(0.75rem + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--hr-card) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--hr-border) 70%, transparent);
  box-shadow: 0 16px 40px -20px rgba(60, 50, 43, 0.45);
  backdrop-filter: blur(12px);
}
.pwa-banner__icon img {
  display: block;
  border-radius: 0.7rem;
}
.pwa-banner__text {
  flex: 1;
  min-width: 0;
}
.pwa-banner__title {
  font-size: 0.85rem;
  font-weight: 650;
}
.pwa-banner__desc {
  margin-top: 0.15rem;
  font-size: 0.7rem;
  color: var(--hr-muted);
  line-height: 1.5;
}
.pwa-banner__actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.pwa-banner-enter-active,
.pwa-banner-leave-active {
  transition: opacity 0.3s ease, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.pwa-banner-enter-from,
.pwa-banner-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
