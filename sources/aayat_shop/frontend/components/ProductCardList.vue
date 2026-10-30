<script setup lang="ts">
import type { Product } from '~/types';
import { STORE_MODE } from '~/constants/site';

const props = withDefaults(
  defineProps<{
    products: Product[];
    layout?: 'strip' | 'grid';
    density?: 'default' | 'compact' | 'sarak';
    hasMore?: boolean;
    loadingMore?: boolean;
    resetScrollKey?: string | number;
  }>(),
  {
    layout: 'grid',
    density: STORE_MODE === 'clothing' ? 'sarak' : 'default',
    hasMore: false,
    loadingMore: false,
  }
);

const emit = defineEmits<{
  'load-more': [];
}>();

const cardSize = computed(() => {
  if (props.density === 'compact') return 'compact';
  if (props.density === 'sarak') return 'sarak';
  return 'default';
});
const stripClass = computed(() => {
  if (props.density === 'sarak') return 'product-card-strip product-card-strip-sarak';
  if (props.density === 'compact') return 'product-card-strip product-card-strip-compact';
  return 'product-card-strip';
});
const slotClass = computed(() => {
  if (props.density === 'sarak') return 'product-card-slot product-card-slot-sarak';
  if (props.density === 'compact') return 'product-card-slot product-card-slot-compact';
  return 'product-card-slot';
});
const gridClass = computed(() => {
  if (props.density === 'sarak') return 'product-card-grid-sarak';
  if (props.density === 'compact') return 'product-card-grid-compact';
  return 'product-card-grid';
});
const showStripNav = computed(() => props.density !== 'sarak');

const stripRef = ref<HTMLElement | null>(null);
const canScrollPrev = ref(false);
const canScrollNext = ref(false);

useHorizontalDragScroll(stripRef);

const canLoadMore = computed(() => props.hasMore && !props.loadingMore);

const { sentinel: loadMoreSentinel } = useHorizontalInfiniteScroll(
  stripRef,
  () => emit('load-more'),
  { enabled: canLoadMore }
);

function updateScrollState() {
  const el = stripRef.value;
  if (!el) return;
  const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
  canScrollPrev.value = el.scrollLeft > 2;
  canScrollNext.value = maxScroll > 2 && el.scrollLeft < maxScroll - 2;
}

function scrollStrip(direction: 'prev' | 'next') {
  const el = stripRef.value;
  if (!el) return;
  const step = Math.max(el.clientWidth * 0.72, 176);
  const delta = direction === 'next' ? step : -step;
  el.scrollBy({ left: delta, behavior: 'smooth' });
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (props.layout !== 'strip') return;
  nextTick(() => {
    const el = stripRef.value;
    updateScrollState();
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateScrollState();
      });
      resizeObserver.observe(el);
    }
    window.addEventListener('resize', updateScrollState);
  });
});

onUnmounted(() => {
  stripRef.value?.removeEventListener('scroll', updateScrollState);
  resizeObserver?.disconnect();
  window.removeEventListener('resize', updateScrollState);
});

watch(
  () => props.resetScrollKey,
  () => {
    nextTick(() => {
      const el = stripRef.value;
      if (el) el.scrollLeft = 0;
      updateScrollState();
    });
  }
);

watch(
  () => props.products.length,
  () => nextTick(updateScrollState)
);
</script>

<template>
  <div v-if="layout === 'strip'" class="relative min-w-0 w-full product-card-strip-shell">
    <button
      v-show="showStripNav && canScrollPrev"
      type="button"
      class="product-card-strip-nav product-card-strip-nav-prev"
      aria-label="محصولات قبلی"
      @click="scrollStrip('prev')"
    >
      <AppIcon name="lucide:chevron-right" size="sm" />
    </button>
    <button
      v-show="showStripNav && canScrollNext"
      type="button"
      class="product-card-strip-nav product-card-strip-nav-next"
      aria-label="محصولات بعدی"
      @click="scrollStrip('next')"
    >
      <AppIcon name="lucide:chevron-left" size="sm" />
    </button>

    <div ref="stripRef" :class="stripClass">
      <div v-for="product in products" :key="product.id" :class="slotClass">
        <ProductCard :product="product" :size="cardSize" class="h-full" />
      </div>
      <div
        v-if="hasMore"
        ref="loadMoreSentinel"
        class="product-card-strip-sentinel"
        aria-hidden="true"
      />
      <div v-if="loadingMore" class="product-card-strip-loader" aria-hidden="true">
        <span class="product-card-strip-loader-dot" />
      </div>
    </div>
  </div>

  <div v-else :class="gridClass">
    <ProductCard
      v-for="product in products"
      :key="product.id"
      :product="product"
      :size="cardSize"
      class="h-full"
    />
  </div>
</template>
