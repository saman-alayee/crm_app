<script setup lang="ts">
const props = defineProps<{
  images: string[];
  activeIndex: number;
  productName: string;
  favorited: boolean;
}>();

const emit = defineEmits<{
  'update:activeIndex': [index: number];
  toggleFavorite: [];
}>();

const { getProductImage } = useFormat();

const activeSrc = computed(() => {
  const raw = props.images[props.activeIndex];
  return raw ? getProductImage(raw) : getProductImage(null);
});

const hasMany = computed(() => props.images.length > 1);

function step(delta: number) {
  const count = props.images.length;
  if (count < 2) return;
  emit('update:activeIndex', (props.activeIndex + delta + count) % count);
}
</script>

<template>
  <div class="md:sticky md:top-24">
    <div class="relative">
      <div class="relative -mx-4 overflow-hidden bg-white md:mx-0">
        <img
          :src="activeSrc"
          :alt="productName"
          class="block h-auto w-full"
          loading="eager"
        />
        <button
          type="button"
          class="product-fav-btn absolute top-3 left-3 z-20 flex h-11 w-11 items-center justify-center rounded-full"
          :class="{ 'is-on': favorited }"
          :aria-pressed="favorited"
          :aria-label="favorited ? 'حذف از ذخیره‌ها' : 'ذخیره محصول'"
          @click="emit('toggleFavorite')"
        >
          <AppIcon name="lucide:bookmark" size="md" class="product-fav-btn__icon" />
        </button>
        <template v-if="hasMany">
          <button
            type="button"
            class="absolute top-1/2 start-3 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-700 shadow-md"
            aria-label="تصویر قبلی"
            @click="step(-1)"
          >
            <AppIcon name="lucide:chevron-right" size="md" />
          </button>
          <button
            type="button"
            class="absolute top-1/2 end-3 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-700 shadow-md"
            aria-label="تصویر بعدی"
            @click="step(1)"
          >
            <AppIcon name="lucide:chevron-left" size="md" />
          </button>
        </template>
      </div>

      <div
        v-if="hasMany"
        class="mt-3 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide"
      >
        <button
          v-for="(image, index) in images"
          :key="`${image}-${index}`"
          type="button"
          :class="[
            'h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg border bg-white',
            activeIndex === index ? 'border-[#ef394e]' : 'border-gray-200',
          ]"
          @click="emit('update:activeIndex', index)"
        >
          <img
            :src="getProductImage(image)"
            :alt="`${productName} ${index + 1}`"
            class="h-full w-full object-cover"
            loading="lazy"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-fav-btn {
  color: #3f3f46;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 2px 8px rgba(26, 15, 18, 0.1);
  transition:
    transform 0.18s ease,
    color 0.18s ease,
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.product-fav-btn:hover {
  transform: scale(1.05);
  color: #6f5644;
}

.product-fav-btn.is-on {
  color: #ef394e;
  background: #fff5f6;
  border-color: rgba(239, 57, 78, 0.35);
  animation: product-fav-pop 0.45s cubic-bezier(0.22, 1.4, 0.36, 1);
}

.product-fav-btn :deep(svg.product-fav-btn__icon path) {
  stroke-width: 2.35;
  fill: transparent;
}

.product-fav-btn.is-on :deep(svg.product-fav-btn__icon),
.product-fav-btn.is-on :deep(svg.product-fav-btn__icon path) {
  fill: #ef394e !important;
  stroke: #ef394e !important;
  color: #ef394e !important;
}

@keyframes product-fav-pop {
  0% { transform: scale(1); }
  30% { transform: scale(1.22); }
  100% { transform: scale(1); }
}
</style>
