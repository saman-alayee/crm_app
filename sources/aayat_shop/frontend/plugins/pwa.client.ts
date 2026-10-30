export default defineNuxtPlugin(() => {
  if (!import.meta.client) return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
  });
});
