<script setup lang="ts">
import type { Product } from '~/types';
import { STORE_MODE } from '~/constants/site';
import { parseClothingMeta } from '~/utils/clothing';

const props = withDefaults(
  defineProps<{ product: Product; size?: 'default' | 'compact' | 'sarak' }>(),
  { size: 'default' }
);

const isClothingStore = STORE_MODE === 'clothing';
const fabricLabel = computed(
  () => parseClothingMeta(props.product)?.fabric || props.product.unit || '\u00A0'
);

const cartStore = useCartStore();
const { formatPriceCompact, getProductImage } = useFormat();
const { isFavorite, toggleFavorite } = useFavorites();

const isCompact = computed(() => props.size === 'compact');
const isSarak = computed(() => props.size === 'sarak');

const clothingMeta = computed(() => parseClothingMeta(props.product));
const colorLabels = computed(() => clothingMeta.value?.colors?.map((c) => c.name).slice(0, 4) ?? []);

const {
  primarySrc: cardPrimarySrc,
  hoverSrc: cardHoverSrc,
  hoverEnabled: cardHoverEnabled,
  onPrimaryError: onCardPrimaryError,
  onHoverError: onCardHoverError,
  preloadHover: preloadCardHover,
} = useProductCardImages(toRef(props, 'product'));

const cardHasSwapHover = computed(() => Boolean(cardHoverSrc.value));
const sarakMediaRef = ref<HTMLElement | null>(null);

let sarakImageObserver: IntersectionObserver | null = null;

onMounted(() => {
  if (!isSarak.value) return;
  nextTick(() => {
    const el = sarakMediaRef.value;
    if (!el || typeof IntersectionObserver === 'undefined') {
      preloadCardHover();
      return;
    }
    sarakImageObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          preloadCardHover();
          sarakImageObserver?.disconnect();
          sarakImageObserver = null;
        }
      },
      { rootMargin: '160px 0px' }
    );
    sarakImageObserver.observe(el);
  });
});

onUnmounted(() => {
  sarakImageObserver?.disconnect();
  sarakImageObserver = null;
});

const outOfStock = computed(() => !props.product.inStock);
const quantity = computed(() => cartStore.getItemQuantity(props.product.id));
const isAdding = computed(() => cartStore.addingProductId === props.product.id);
const favorited = computed(() => isFavorite(props.product.id));
const favLoading = ref(false);
const heartPop = ref(false);

async function handleFavorite(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  if (favLoading.value) return;
  const wasOn = favorited.value;
  favLoading.value = true;
  try {
    await toggleFavorite(props.product.id);
    if (!wasOn) {
      heartPop.value = true;
      window.setTimeout(() => {
        heartPop.value = false;
      }, 520);
    }
  } finally {
    favLoading.value = false;
  }
}

async function handleAdd(event?: Event) {
  event?.preventDefault();
  event?.stopPropagation();
  await cartStore.addItem(props.product.id);
}

async function handleIncrease(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  await cartStore.updateQuantity(props.product.id, quantity.value + 1);
}

async function handleDecrease(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  if (quantity.value <= 1) {
    await cartStore.removeItem(props.product.id);
  } else {
    await cartStore.updateQuantity(props.product.id, quantity.value - 1);
  }
}


</script>

<template>
  <!-- سبک sarak-co.com -->
  <article
    v-if="isSarak"
    class="product-card product-card--sarak relative flex h-full w-full flex-col bg-white"
    :class="{ 'is-out': outOfStock }"
  >
    <NuxtLink
      ref="sarakMediaRef"
      :to="`/products/${product.slug}`"
      :class="[
        'product-card-sarak-media relative block aspect-[3/4] w-full overflow-hidden bg-neutral-100',
        cardHasSwapHover ? 'product-card-sarak-media--swap' : 'product-card-sarak-media--lift',
      ]"
      draggable="false"
      @mouseenter="preloadCardHover()"
      @focusin="preloadCardHover()"
    >
      <span class="product-card-sarak-shine" aria-hidden="true" />
      <img
        :src="cardPrimarySrc"
        :alt="product.name"
        class="product-card-sarak-img-primary absolute inset-0 h-full w-full object-cover object-center"
        :class="[
          cardHoverSrc ? 'product-card-sarak-img-primary--swap' : 'product-card-sarak-img-primary--zoom',
          cardHoverEnabled ? 'product-card-sarak-img-primary--hide-on-hover' : '',
        ]"
        loading="lazy"
        decoding="async"
        width="400"
        height="533"
        draggable="false"
        @error="onCardPrimaryError()"
      />
      <img
        v-if="cardHoverSrc"
        :src="cardHoverSrc"
        :alt="product.name"
        class="product-card-sarak-img-hover absolute inset-0 h-full w-full object-cover object-center"
        :class="cardHoverEnabled ? 'product-card-sarak-img-hover--ready' : ''"
        loading="lazy"
        decoding="async"
        width="400"
        height="533"
        draggable="false"
        @error="onCardHoverError()"
      />

      <div
        v-if="colorLabels.length"
        class="product-card-sarak-colors pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap gap-x-3 gap-y-1 px-3 pb-3 pt-12"
      >
        <span
          v-for="label in colorLabels"
          :key="label"
          class="text-xs font-normal leading-none text-white"
        >
          {{ label }}
        </span>
      </div>
    </NuxtLink>

    <button
      type="button"
      class="product-card-fav absolute top-2.5 end-2.5 z-20 flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-60"
      :class="{ 'is-on': favorited, 'is-pop': heartPop }"
      :disabled="favLoading"
      :aria-pressed="favorited"
      :aria-label="favorited ? 'حذف از ذخیره‌ها' : 'ذخیره محصول'"
      @click="handleFavorite"
    >
      <AppIcon name="lucide:bookmark" size="md" class="product-card-fav__icon" />
    </button>

    <div class="flex flex-col gap-2 px-3 pb-3.5 pt-3.5 md:px-3.5 md:pb-4 md:pt-4">
      <NuxtLink
        :to="`/products/${product.slug}`"
        class="line-clamp-2 text-[0.9375rem] font-medium leading-6 tracking-tight text-primary-900 transition-opacity hover:opacity-70 md:text-base md:leading-7"
        draggable="false"
      >
        {{ product.name }}
      </NuxtLink>

      <p v-if="outOfStock" class="product-card-oos">ناموجود</p>
      <div v-else class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          v-if="product.discountPrice"
          class="price-text text-[0.75rem] font-normal leading-none text-primary-400 line-through decoration-primary-300"
        >
          {{ formatPriceCompact(product.price) }}
        </span>
        <span class="price-text text-[0.9375rem] font-semibold leading-none tracking-tight text-primary-900 md:text-base">
          {{ formatPriceCompact(product.effectivePrice) }}
        </span>
        <span class="text-[0.6875rem] font-normal leading-none text-primary-500">تومان</span>
      </div>
    </div>
  </article>

  <!-- سبک فروشگاه قبلی -->
  <div
    v-else
    :class="[
      'product-card group relative flex h-full w-full flex-col overflow-hidden bg-white',
      isCompact ? 'rounded-lg border border-gray-100/90' : 'rounded-xl border border-gray-100',
      outOfStock ? 'is-out' : '',
    ]"
  >
    <div class="relative shrink-0 overflow-hidden bg-neutral-50 aspect-[4/5]">
      <NuxtLink :to="`/products/${product.slug}`" class="block h-full w-full" draggable="false">
        <img
          :src="getProductImage(product.image)"
          :alt="product.name"
          class="pointer-events-none h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
          decoding="async"
          width="400"
          height="533"
          draggable="false"
          @error="(e) => { const t = e.target as HTMLImageElement; if (t) t.src = '/images/placeholder-product.svg' }"
        />
      </NuxtLink>

      <div
        v-if="product.discountPercent > 0"
        :class="[
          'absolute z-10 font-bold text-white bg-red-500',
          isCompact ? 'top-0 start-0 rounded-ee-lg px-1.5 py-0.5 text-[9px]' : 'top-0 start-0 rounded-ee-xl px-2 py-1 text-[10px]',
        ]"
      >
        {{ product.discountPercent }}٪
      </div>

      <div
        v-if="product.isNew || product.isOldPrice"
        class="absolute top-0 end-0 z-10 flex flex-col items-end gap-0.5"
      >
        <div
          v-if="product.isNew"
          :class="[
            'font-bold text-white bg-accent-500',
            isCompact ? 'rounded-es-lg px-1.5 py-0.5 text-[9px]' : 'rounded-es-xl px-2 py-1 text-[10px]',
          ]"
        >
          جدید
        </div>
        <div
          v-if="product.isOldPrice"
          :class="[
            'font-bold text-white bg-amber-600',
            isCompact ? 'rounded-es-lg px-1.5 py-0.5 text-[8px] leading-tight' : 'rounded-es-xl px-2 py-1 text-[10px]',
          ]"
        >
          قیمت قدیم
        </div>
      </div>

      <button
        type="button"
        class="product-card-fav absolute z-20 disabled:opacity-60"
        :class="[
          isCompact ? 'bottom-1.5 start-1.5 h-8 w-8' : 'bottom-2 end-2 h-10 w-10',
          { 'is-on': favorited, 'is-pop': heartPop },
        ]"
        :disabled="favLoading"
        :aria-pressed="favorited"
        :aria-label="favorited ? 'حذف از ذخیره‌ها' : 'ذخیره محصول'"
        @click="handleFavorite"
      >
        <AppIcon
          name="lucide:bookmark"
          :size="isCompact ? 'sm' : 'md'"
          class="product-card-fav__icon"
        />
      </button>

      <div v-if="isCompact && !isClothingStore && product.inStock" class="absolute bottom-1.5 end-1.5 z-20">
        <div v-if="quantity === 0">
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white shadow-md transition-all hover:bg-primary-700 active:scale-95"
            :disabled="isAdding"
            @click="handleAdd"
          >
            <AppIcon v-if="!isAdding" name="lucide:plus" size="xs" />
            <AppIcon v-else name="lucide:loader-2" size="xs" class="animate-spin" />
          </button>
        </div>
        <div v-else class="flex items-center rounded-full bg-white/95 shadow-md ring-1 ring-primary-100">
          <button type="button" class="flex h-6 w-6 items-center justify-center text-primary-600" @click="handleDecrease">
            <AppIcon name="lucide:minus" size="xs" />
          </button>
          <span class="min-w-[14px] text-center text-[10px] font-bold text-primary-700">{{ quantity }}</span>
          <button type="button" class="flex h-6 w-6 items-center justify-center text-primary-600" @click="handleIncrease">
            <AppIcon name="lucide:plus" size="xs" />
          </button>
        </div>
      </div>
    </div>

    <div
      :class="
        isCompact ? 'flex flex-1 flex-col px-2 pb-2 pt-1.5' : 'flex flex-1 flex-col px-3 pb-3 pt-2.5'
      "
    >
      <NuxtLink
        :to="`/products/${product.slug}`"
        :class="isCompact ? 'block h-[1.85rem] shrink-0' : 'block h-[2.6rem] shrink-0'"
        draggable="false"
      >
        <h3
          :class="[
            'line-clamp-2 font-medium text-gray-800',
            isCompact ? 'text-[11px] leading-[0.925rem]' : 'text-sm leading-[1.125rem]',
          ]"
        >
          {{ product.name }}
        </h3>
      </NuxtLink>

      <p
        v-if="!isCompact"
        class="mt-1 h-[15px] shrink-0 truncate text-[11px] leading-[15px] text-gray-400"
      >
        {{ fabricLabel }}
      </p>

      <div :class="isCompact ? 'mt-auto pt-1' : 'mt-auto flex flex-col gap-2.5 pt-2'">
        <div :class="isCompact ? 'shrink-0' : 'h-[2.6rem] shrink-0'">
          <p v-if="outOfStock" class="product-card-oos">ناموجود</p>
          <template v-else>
            <p
              v-if="product.discountPrice"
              :class="[
                'price-text line-through text-gray-400',
                isCompact ? 'mb-0 h-[10px] text-[9px] leading-[10px]' : 'mb-0.5 h-[15px] text-[11px] leading-[15px]',
              ]"
            >
              {{ formatPriceCompact(product.price) }}
            </p>
            <p
              :class="[
                'price-text font-bold leading-tight text-gray-900',
                isCompact ? 'text-[11px]' : 'text-base',
              ]"
            >
              {{ formatPriceCompact(product.effectivePrice) }}
              <span :class="isCompact ? 'text-[9px] font-medium text-gray-500' : 'text-[11px] font-medium text-gray-500'">
                تومان
              </span>
            </p>
          </template>
        </div>

        <div v-if="!isCompact && !isClothingStore && product.inStock" class="flex h-10 shrink-0 items-center justify-end">
          <div v-if="quantity === 0">
            <button
              class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white transition-all hover:bg-primary-700 active:scale-95"
              :disabled="isAdding"
              @click.stop="handleAdd"
            >
              <AppIcon v-if="!isAdding" name="lucide:plus" size="sm" />
              <AppIcon v-else name="lucide:loader-2" size="sm" class="animate-spin" />
            </button>
          </div>
          <div v-else class="flex items-center rounded-lg bg-primary-50">
            <button class="flex h-8 w-8 items-center justify-center text-primary-600 hover:bg-primary-100" @click.stop="handleDecrease">
              <AppIcon name="lucide:minus" size="sm" />
            </button>
            <span class="w-6 text-center text-sm font-bold text-primary-700">{{ quantity }}</span>
            <button class="flex h-8 w-8 items-center justify-center text-primary-600 hover:bg-primary-100" @click.stop="handleIncrease">
              <AppIcon name="lucide:plus" size="sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-card-oos {
  align-self: flex-start;
  width: fit-content;
  border-radius: 9999px;
  background: #f3ebe3;
  padding: 3px 9px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.4;
  color: #6f5644;
}

.product-card-sarak-media {
  isolation: isolate;
}

.product-card-sarak-media::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(
    165deg,
    transparent 35%,
    rgba(101, 42, 59, 0.07) 100%
  );
  transition: opacity 0.45s ease;
}

.product-card-sarak-shine {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(
    115deg,
    transparent 42%,
    rgba(255, 255, 255, 0.22) 50%,
    transparent 58%
  );
  transform: translateX(-120%) skewX(-12deg);
  transition: transform 0.85s cubic-bezier(0.22, 1, 0.36, 1);
}

.product-card-sarak-img-primary,
.product-card-sarak-img-hover {
  transition:
    opacity 0.55s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.65s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.5s ease;
  will-change: opacity, transform;
}

.product-card-sarak-img-hover {
  opacity: 0;
  transform: scale(1.06) translateY(10px);
  filter: brightness(1.02);
}

.product-card-sarak-colors {
  opacity: 0;
  transform: translateY(6px);
  transition:
    opacity 0.3s ease,
    transform 0.35s ease;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.45), transparent 72%);
  z-index: 3;
}

@media (hover: hover) and (pointer: fine) {
  .product-card--sarak:hover .product-card-sarak-media::after {
    opacity: 1;
  }

  .product-card--sarak:hover .product-card-sarak-shine {
    transform: translateX(120%) skewX(-12deg);
  }

  .product-card--sarak:hover .product-card-sarak-img-primary--hide-on-hover {
    opacity: 0;
    transform: scale(1.04);
    filter: brightness(0.98);
  }

  .product-card--sarak:hover .product-card-sarak-img-hover--ready {
    opacity: 1;
    transform: scale(1) translateY(0);
  }

  .product-card--sarak:hover .product-card-sarak-img-primary--zoom {
    transform: scale(1.09);
    filter: brightness(1.03) contrast(1.02);
  }

  .product-card--sarak:hover .product-card-sarak-colors {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .product-card-sarak-img-primary,
  .product-card-sarak-img-hover,
  .product-card-sarak-shine,
  .product-card-sarak-media::after {
    transition: none;
  }
}

.product-card-fav {
  border-radius: 9999px;
  background: #fff;
  color: #3f3f46;
  box-shadow:
    0 1px 2px rgba(26, 15, 18, 0.12),
    0 6px 16px rgba(26, 15, 18, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.95);
  transition:
    transform 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.product-card-fav:hover {
  transform: scale(1.06);
  color: #652a3b;
  box-shadow:
    0 2px 4px rgba(26, 15, 18, 0.14),
    0 10px 22px rgba(101, 42, 59, 0.18);
}

.product-card-fav.is-on {
  color: #ef394e;
  background: #fff5f6;
  border-color: rgba(239, 57, 78, 0.28);
  box-shadow:
    0 1px 2px rgba(239, 57, 78, 0.16),
    0 8px 18px rgba(239, 57, 78, 0.22);
}

.product-card-fav.is-pop {
  animation: product-fav-pop 0.52s cubic-bezier(0.22, 1.4, 0.36, 1);
}

.product-card-fav :deep(svg.product-card-fav__icon path) {
  stroke-width: 2.35;
  fill: transparent;
  transition:
    fill 0.18s ease,
    stroke 0.18s ease;
}

.product-card-fav.is-on :deep(svg.product-card-fav__icon),
.product-card-fav.is-on :deep(svg.product-card-fav__icon path) {
  fill: #ef394e !important;
  stroke: #ef394e !important;
  color: #ef394e !important;
}

@keyframes product-fav-pop {
  0% {
    transform: scale(1);
  }
  28% {
    transform: scale(1.28);
  }
  55% {
    transform: scale(0.92);
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .product-card-fav.is-pop {
    animation: none;
  }
}
</style>
