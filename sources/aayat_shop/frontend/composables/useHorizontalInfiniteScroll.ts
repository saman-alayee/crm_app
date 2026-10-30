/**
 * Load more items when a sentinel nears the edge of a horizontal scroll container.
 */
export function useHorizontalInfiniteScroll(
  containerRef: Ref<HTMLElement | null>,
  onLoadMore: () => void | Promise<void>,
  options?: {
    enabled?: Ref<boolean> | ComputedRef<boolean>;
    rootMargin?: string;
  }
) {
  const sentinel = ref<HTMLElement | null>(null);
  const rootMargin = options?.rootMargin ?? '160px 0px';

  const isEnabled = computed(() => {
    if (options?.enabled === undefined) return true;
    return unref(options.enabled);
  });

  onMounted(() => {
    if (!import.meta.client) return;

    let observer: IntersectionObserver | null = null;

    const bind = () => {
      observer?.disconnect();
      const root = containerRef.value;
      const target = sentinel.value;
      if (!root || !target || !isEnabled.value) return;

      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && isEnabled.value) {
            void onLoadMore();
          }
        },
        { root, rootMargin, threshold: 0.01 }
      );
      observer.observe(target);
    };

    watch([containerRef, sentinel, isEnabled], () => nextTick(bind), { flush: 'post' });
    onUnmounted(() => observer?.disconnect());
  });

  return { sentinel };
}
