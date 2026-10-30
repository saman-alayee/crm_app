export default defineNuxtPlugin(() => {
  // Ensure service worker registration side-effects from @vite-pwa/nuxt are active
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[PWA] enabled in development — use HTTPS or LAN IP on phone for install tests');
  }
});
