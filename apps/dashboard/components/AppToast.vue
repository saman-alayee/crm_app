<script setup lang="ts">
const { toasts, dismiss } = useToast();
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+1rem)] z-[300] flex flex-col gap-2 md:inset-x-auto md:end-4 md:items-end"
  >
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'pointer-events-auto flex w-full items-start justify-between gap-3 rounded-xl px-4 py-3.5 text-sm shadow-lg md:max-w-sm',
          toast.type === 'success' ? 'bg-green-600 text-white' : '',
          toast.type === 'error' ? 'bg-red-600 text-white' : '',
          toast.type === 'info' ? 'bg-gray-800 text-white' : '',
        ]"
        role="status"
        aria-live="polite"
      >
        <span class="leading-relaxed">{{ toast.message }}</span>
        <button
          class="flex min-h-[32px] min-w-[32px] shrink-0 items-center justify-center opacity-80 hover:opacity-100"
          type="button"
          @click="dismiss(toast.id)"
        >
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
  transform: translateY(-8px);
}
</style>
