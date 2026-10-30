<script setup lang="ts">
const auth = useAuthStore();
</script>

<template>
  <div class="app-shell">
    <NuxtPwaManifest />
    <NuxtLayout>
      <!-- :key remounts KeepAlive tree on login/logout so pages never leak between users -->
      <NuxtPage
        :key="auth.sessionEpoch"
        :keepalive="{ max: 12 }"
        :transition="{ name: 'admin-page', mode: 'out-in' }"
      />
    </NuxtLayout>
    <AppToast />
    <ClientOnly>
      <PwaInstallBanner />
    </ClientOnly>
  </div>
</template>

<style>
html.dark .app-shell {
  color-scheme: dark;
}
@media (display-mode: standalone) {
  body {
    padding-top: env(safe-area-inset-top);
  }
}

.admin-page-enter-active,
.admin-page-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}
.admin-page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.admin-page-leave-to {
  opacity: 0;
}
</style>
