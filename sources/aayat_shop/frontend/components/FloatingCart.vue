<script setup lang="ts">
const route = useRoute();
const cartStore = useCartStore();
const { formatPrice, toPersianDigits } = useFormat();

const show = computed(() => {
  const path = route.path;
  if (path === '/cart' || path.startsWith('/cart/')) return false;
  if (path === '/checkout' || path.startsWith('/checkout/')) return false;
  return cartStore.totalItems > 0;
});
</script>

<template>
  <Transition
    enter-active-class="transition-transform duration-300 ease-out"
    enter-from-class="translate-y-full"
    enter-to-class="translate-y-0"
    leave-active-class="transition-transform duration-200 ease-in"
    leave-from-class="translate-y-0"
    leave-to-class="translate-y-full"
  >
    <div
      v-if="show"
      class="fixed bottom-16 start-3 end-3 z-40 mx-auto max-w-md md:bottom-4 md:max-w-lg"
    >
      <NuxtLink
        to="/cart"
        class="flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-white shadow-float md:gap-2.5 md:px-3.5 md:py-2.5"
      >
        <div class="relative shrink-0">
          <AppIcon name="lucide:shopping-bag" size="md" />
          <span class="absolute -top-1.5 -start-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-600 px-0.5 text-[9px] font-bold text-white">
            {{ toPersianDigits(cartStore.totalItems) }}
          </span>
        </div>

        <div class="min-w-0 flex-1 leading-tight">
          <p class="text-sm font-bold md:text-[15px]">{{ formatPrice(cartStore.totalPrice) }}</p>
          <p class="text-[10px] text-gray-400 md:text-[11px]">{{ toPersianDigits(cartStore.totalItems) }} کالا</p>
        </div>

        <span class="inline-flex shrink-0 items-center whitespace-nowrap rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white md:px-3.5 md:py-2 md:text-sm">
          تسویه حساب
        </span>
      </NuxtLink>
    </div>
  </Transition>
</template>
