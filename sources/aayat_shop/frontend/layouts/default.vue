<script setup lang="ts">
const authStore = useAuthStore();
const cartStore = useCartStore();

onMounted(() => {
  authStore.init();
  cartStore.fetchCart();
});
</script>

<template>
  <div class="min-h-screen flex min-w-0 flex-col overflow-x-clip">
    <AppHeader />
    <main class="min-w-0 flex-1 safe-bottom">
      <slot />
    </main>
    <FloatingCart />
    <AppFooter />
    <BottomNav />
  </div>
</template>
