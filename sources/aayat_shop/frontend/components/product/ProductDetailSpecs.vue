<script setup lang="ts">
import type { ClothingMeta, Product } from '~/types';

const props = defineProps<{
  product: Product;
  clothingMeta: ClothingMeta | null;
  isDemoProduct: boolean;
  inStockDisplay: boolean;
  canPurchase: boolean;
  quantity: number;
  adding?: boolean;
  justAdded?: boolean;
}>();

const selectedColor = defineModel<string | undefined>('selectedColor');
const selectedSize = defineModel<string | undefined>('selectedSize');

const emit = defineEmits<{
  addToCart: [];
  decreaseQty: [];
  increaseQty: [];
  removeFromCart: [];
}>();

const { formatPrice } = useFormat();

function share(kind: 'whatsapp' | 'telegram' | 'twitter' | 'facebook') {
  if (!import.meta.client) return;
  const url = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(props.product.name);
  const links = {
    whatsapp: `https://wa.me/?text=${text}%20${url}`,
    telegram: `https://t.me/share/url?url=${url}&text=${text}`,
    twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
  };
  window.open(links[kind], '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <div class="mt-5 flex min-w-0 flex-col md:mt-1">
    <h1 class="text-[19px] font-bold leading-8 text-[#3c322b] md:text-xl">
      {{ product.name }}
    </h1>
    <ProductRating
      v-if="product.ratingCount"
      class="mt-2"
      :value="product.ratingAvg || 0"
      :count="product.ratingCount"
      size="md"
    />

    <div class="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2">
      <p class="text-[22px] font-bold leading-none text-[#3c322b]">
        {{ formatPrice(product.effectivePrice) }}
      </p>
      <p v-if="product.discountPrice" class="text-sm text-gray-400 line-through">
        {{ formatPrice(product.price) }}
      </p>
      <span
        v-if="!isDemoProduct && !inStockDisplay"
        class="inline-flex w-fit items-center rounded bg-[#fde8e6] px-1.5 py-px text-[11px] font-semibold leading-5 text-[#b42318]"
      >
        ناموجود
      </span>
    </div>

    <p v-if="isDemoProduct" class="mt-2 text-xs text-gray-500">موجود — فقط نمایشی</p>
    <p v-else-if="!inStockDisplay" class="mt-2 text-sm text-neutral-500">
      این محصول فعلاً موجود نیست؛ مشخصات را می‌توانید ببینید.
    </p>

    <div
      v-if="clothingMeta?.sizes?.length || clothingMeta?.colors?.length"
      class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <label v-if="clothingMeta?.sizes?.length" class="block">
        <span class="field-label">سایز</span>
        <select v-model="selectedSize" class="input-field">
          <option v-for="size in clothingMeta.sizes" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>

      <label v-if="clothingMeta?.colors?.length" class="block">
        <span class="field-label">رنگ</span>
        <select v-model="selectedColor" class="input-field">
          <option v-for="color in clothingMeta.colors" :key="color.name" :value="color.name">
            {{ color.name }}
          </option>
        </select>
      </label>
    </div>

    <div class="mt-5 hidden items-center gap-3 md:flex">
      <button
        v-if="quantity === 0 || justAdded || adding"
        type="button"
        class="inline-flex h-12 min-w-[190px] items-center justify-center gap-2 rounded-lg px-6 text-sm text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-300"
        :class="justAdded ? 'bg-[#1f8a4c]' : 'bg-primary-700 hover:bg-primary-800'"
        :disabled="!canPurchase || adding"
        @click="emit('addToCart')"
      >
        <AppIcon v-if="justAdded" name="lucide:check" size="sm" />
        {{ !canPurchase ? 'ناموجود' : adding ? 'در حال افزودن…' : justAdded ? 'به سبد اضافه شد' : 'افزودن به سبد خرید' }}
      </button>

      <div v-else class="inline-flex h-12 min-w-[190px] items-center justify-between gap-3 rounded-lg bg-[#1f8a4c] px-3 text-white">
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-md bg-white/15"
          aria-label="کم کردن"
          @click="quantity <= 1 ? emit('removeFromCart') : emit('decreaseQty')"
        >
          <AppIcon name="lucide:minus" size="sm" />
        </button>
        <span class="text-sm font-bold">{{ quantity }} در سبد</span>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-md bg-white/15"
          aria-label="زیاد کردن"
          @click="emit('increaseQty')"
        >
          <AppIcon name="lucide:plus" size="sm" />
        </button>
      </div>
    </div>

    <div class="mt-4 flex items-center gap-2 text-gray-400">
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 hover:text-[#25D366]" aria-label="واتساپ" @click="share('whatsapp')">
        <AppIcon name="lucide:message-circle" size="sm" />
      </button>
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 hover:text-[#229ED9]" aria-label="تلگرام" @click="share('telegram')">
        <AppIcon name="lucide:send" size="sm" />
      </button>
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100" aria-label="ایکس" @click="share('twitter')">
        <AppIcon name="lucide:twitter" size="sm" />
      </button>
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 hover:text-[#1877F2]" aria-label="فیسبوک" @click="share('facebook')">
        <AppIcon name="lucide:facebook" size="sm" />
      </button>
    </div>

    <div
      v-if="product.description"
      class="mt-8 text-sm leading-8 text-[#6e655d] whitespace-pre-line"
    >
      {{ product.description }}
    </div>

    <div v-if="clothingMeta?.sizeGuide" class="mt-6 text-sm leading-8 text-[#6e655d] whitespace-pre-line">
      <p class="mb-1 font-bold text-[#3c322b]">راهنمای سایز</p>
      {{ clothingMeta.sizeGuide }}
    </div>
  </div>
</template>
