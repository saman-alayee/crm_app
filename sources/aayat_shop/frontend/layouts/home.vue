<script setup lang="ts">
provide('headerOverlay', true);

const authStore = useAuthStore();
const cartStore = useCartStore();

onMounted(() => {
  authStore.init();
  cartStore.fetchCart();
});
</script>

<template>
  <div class="min-h-screen flex min-w-0 flex-col overflow-x-clip bg-white">
    <AppHeader overlay />
    <main class="min-w-0 flex-1 safe-bottom">
      <slot />
    </main>
    <AppFooter />
    <BottomNav />
  </div>
</template>
