/**
 * Load page data once; with KeepAlive, skip refetch until TTL expires.
 * First mount always loads; returning to the page is instant until stale.
 */
export function usePageLoad(loader: () => Promise<void>, ttlMs = 25_000) {
  const loading = ref(true);
  const error = ref('');
  let lastLoadedAt = 0;
  let inflight: Promise<void> | null = null;

  async function load(force = false) {
    if (!force && lastLoadedAt && Date.now() - lastLoadedAt < ttlMs) {
      loading.value = false;
      return;
    }
    if (inflight) return inflight;

    loading.value = !lastLoadedAt;
    error.value = '';
    inflight = (async () => {
      try {
        await loader();
        lastLoadedAt = Date.now();
      } catch (e: unknown) {
        const err = e as { data?: { message?: string }; message?: string };
        error.value = err?.data?.message || err?.message || 'خطا در دریافت اطلاعات';
      } finally {
        loading.value = false;
        inflight = null;
      }
    })();
    return inflight;
  }

  onMounted(() => {
    void load(true);
  });

  onActivated(() => {
    void load(false);
  });

  return {
    loading,
    error,
    reload: () => load(true),
  };
}
