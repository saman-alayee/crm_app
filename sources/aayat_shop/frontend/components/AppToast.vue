<script setup lang="ts">
const { toasts, dismiss } = useToast();
const route = useRoute();

const hasBottomNav = computed(() => {
  const path = route.path;
  return !path.startsWith('/admin') && !path.startsWith('/auth');
});

const isAdmin = computed(() => route.path.startsWith('/admin'));
</script>

<template>
  <div
    :class="[
      'fixed z-[300] flex flex-col gap-2 pointer-events-none inset-x-3 md:start-auto md:end-4 md:inset-x-auto md:items-end',
      isAdmin || !hasBottomNav
        ? 'top-[calc(env(safe-area-inset-top)+4.5rem)] md:top-4'
        : 'bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-auto md:top-4',
    ]"
  >
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'pointer-events-auto w-full md:max-w-sm px-4 py-3.5 rounded-xl shadow-lg text-sm flex items-start justify-between gap-3',
          toast.type === 'success' ? 'bg-green-600 text-white' : '',
          toast.type === 'error' ? 'bg-red-600 text-white' : '',
          toast.type === 'info' ? 'bg-gray-800 text-white' : '',
        ]"
        role="status"
        aria-live="polite"
      >
        <span class="leading-relaxed">{{ toast.message }}</span>
        <button class="opacity-80 hover:opacity-100 shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center" @click="dismiss(toast.id)">
          <AppIcon name="lucide:x" size="sm" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
@media (min-width: 768px) {
  .toast-enter-from,
  .toast-leave-to {
    transform: translateY(-8px);
  }
}
</style>
