<script setup lang="ts">
const authStore = useAuthStore();
const cartStore = useCartStore();
const route = useRoute();

onMounted(() => {
  authStore.init();
  cartStore.fetchCart();

  if (!authStore.isLoggedIn && route.path.startsWith('/profile') && route.path !== '/profile/favorites') {
    navigateTo(`/auth/login?redirect=${encodeURIComponent(route.fullPath)}`);
  }
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50">
    <AppHeader />
    <main class="flex-1 safe-bottom">
      <div class="max-w-3xl mx-auto px-4 py-5">
        <slot />
      </div>
    </main>
    <FloatingCart />
    <AppFooter />
    <BottomNav />
  </div>
</template>
