<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';

const visible = ref(false);
const dismissed = useCookie<boolean>('pwa-install-dismissed', { default: () => false });

let deferredPrompt: Event | null = null;

function showPrompt() {
  if (dismissed.value) return;
  visible.value = true;
}

function hidePrompt() {
  visible.value = false;
  dismissed.value = true;
}

async function installApp() {
  const prompt = deferredPrompt as (Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: string }> }) | null;
  if (!prompt?.prompt) {
    hidePrompt();
    return;
  }

  await prompt.prompt();
  await prompt.userChoice;
  deferredPrompt = null;
  hidePrompt();
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showPrompt();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hidePrompt();
  });
});
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="visible"
      class="fixed bottom-20 md:bottom-4 inset-x-4 z-[70] max-w-lg mx-auto"
    >
      <div class="card p-4 shadow-xl border border-primary-100 bg-white">
        <div class="flex items-start gap-3">
          <div class="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
            <AppIcon name="lucide:smartphone" size="lg" class="text-primary-600" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-gray-800">نصب اپلیکیشن {{ SITE_NAME }}</p>
            <p class="text-xs text-gray-500 mt-1 leading-relaxed">
              برای دسترسی سریع‌تر، اپ را روی صفحه اصلی گوشی خود نصب کنید.
            </p>
            <div class="flex gap-2 mt-3">
              <button type="button" class="btn-primary text-sm py-2 px-4 flex-1" @click="installApp">
                نصب
              </button>
              <button type="button" class="btn-secondary text-sm py-2 px-4" @click="hidePrompt">
                بعداً
              </button>
            </div>
          </div>
          <button type="button" class="p-1 text-gray-400 hover:text-gray-600 shrink-0" @click="hidePrompt">
            <AppIcon name="lucide:x" size="sm" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(1rem);
}
</style>
