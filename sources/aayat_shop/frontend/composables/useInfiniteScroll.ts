export function useInfiniteScroll(onLoadMore: () => void | Promise<void>) {
  const sentinel = ref<HTMLElement | null>(null);

  onMounted(() => {
    if (!import.meta.client) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void onLoadMore();
      },
      { rootMargin: '280px' }
    );

    watch(
      sentinel,
      (el) => {
        observer.disconnect();
        if (el) observer.observe(el);
      },
      { flush: 'post' }
    );

    onUnmounted(() => observer.disconnect());
  });

  return { sentinel };
}
