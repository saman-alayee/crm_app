<script setup lang="ts">
import type { Order, Product } from '~/types';
import { SITE_NAME } from '~/constants/site';

const cartStore = useCartStore();
const authStore = useAuthStore();
const api = useApi();
const { formatPrice, getProductImage, toPersianDigits } = useFormat();
const { nationwideHint, cartHoldMinutes, loadShippingSettings } = useShippingSettings();
const { applied, discountAmount, payable, refresh } = useCoupon();

const suggestedProducts = ref<Product[]>([]);
const suggestionsLoading = ref(false);
const busyId = ref<string | null>(null);
const clearing = ref(false);
const actionError = ref('');
const heldOrders = ref<Order[]>([]);
const heldLoading = ref(false);
const requestingShip = ref(false);
const shipMessage = ref('');

const heldItems = computed(() =>
  heldOrders.value.flatMap((order) =>
    (order.items || []).map((item) => ({
      ...item,
      orderNumber: order.orderNumber,
    }))
  )
);

const pieceLabel = computed(() => {
  const count = cartStore.totalItems;
  return count === 1 ? '۱ لباس' : `${toPersianDigits(count)} لباس`;
});

function hasDiscount(price: number, effectivePrice: number) {
  return price > effectivePrice;
}

async function loadHeldOrders() {
  authStore.init();
  if (!authStore.isLoggedIn) {
    heldOrders.value = [];
    return;
  }
  heldLoading.value = true;
  try {
    const { data } = await api.get<Order[]>('/orders/held');
    heldOrders.value = data;
  } catch {
    heldOrders.value = [];
  } finally {
    heldLoading.value = false;
  }
}

async function requestShipment() {
  if (requestingShip.value || !heldOrders.value.length) return;
  requestingShip.value = true;
  actionError.value = '';
  shipMessage.value = '';
  try {
    const { data } = await api.post<{ count: number }>('/orders/request-shipment', {});
    heldOrders.value = [];
    shipMessage.value =
      data.count > 1
        ? `درخواست ارسال برای ${toPersianDigits(data.count)} سفارش ثبت شد.`
        : 'درخواست ارسال برای شما ثبت شد.';
  } catch (e: unknown) {
    actionError.value = e instanceof Error ? e.message : 'ثبت درخواست ارسال انجام نشد';
  } finally {
    requestingShip.value = false;
  }
}

async function loadSuggestions() {
  if (cartStore.isEmpty) {
    suggestedProducts.value = [];
    return;
  }

  suggestionsLoading.value = true;
  try {
    const inCart = new Set(cartStore.items.map((item) => item.productId));
    const { data } = await api.get<{ products: Product[] }>('/products?limit=16&sort=newest');
    suggestedProducts.value = data.products.filter((product) => !inCart.has(product.id)).slice(0, 8);
  } catch {
    suggestedProducts.value = [];
  } finally {
    suggestionsLoading.value = false;
  }
}

async function changeQuantity(productId: string, quantity: number) {
  if (busyId.value) return;
  busyId.value = productId;
  actionError.value = '';
  try {
    await cartStore.updateQuantity(productId, quantity);
  } catch (e: unknown) {
    actionError.value = e instanceof Error ? e.message : 'تغییر تعداد انجام نشد';
  } finally {
    busyId.value = null;
  }
}

async function removeItem(productId: string) {
  if (busyId.value) return;
  busyId.value = productId;
  actionError.value = '';
  try {
    await cartStore.removeItem(productId);
  } catch (e: unknown) {
    actionError.value = e instanceof Error ? e.message : 'حذف لباس انجام نشد';
  } finally {
    busyId.value = null;
  }
}

function continueCheckout() {
  authStore.init();
  if (!authStore.isLoggedIn) {
    navigateTo(`/auth/login?redirect=${encodeURIComponent('/checkout')}`);
    return;
  }
  navigateTo('/checkout');
}

async function clearCart() {
  if (clearing.value || cartStore.isEmpty) return;
  clearing.value = true;
  actionError.value = '';
  try {
    await cartStore.clearCart();
  } catch (e: unknown) {
    actionError.value = e instanceof Error ? e.message : 'خالی کردن سبد انجام نشد';
  } finally {
    clearing.value = false;
  }
}

onMounted(async () => {
  await Promise.all([cartStore.fetchCart(), loadHeldOrders(), loadShippingSettings()]);
  await refresh(cartStore.totalPrice);
  await loadSuggestions();
});

watch(
  () => cartStore.totalPrice,
  (subtotal) => {
    void refresh(subtotal);
  }
);

watch(
  () => cartStore.items.map((item) => item.productId).join(','),
  loadSuggestions,
);

useHead({
  title: `سبد خرید - ${SITE_NAME}`,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});
</script>

<template>
  <div class="bg-surface-muted pb-36 md:pb-12">
    <div class="mx-auto max-w-[1100px] px-4 py-6 md:py-10">
      <div class="mb-6 flex items-end justify-between gap-3">
        <div>
          <p class="text-xs tracking-wide text-primary-700">{{ SITE_NAME }}</p>
          <h1 class="mt-1 text-2xl font-bold text-[#3c322b]">سبد خرید</h1>
          <p v-if="!cartStore.loading && !cartStore.isEmpty" class="mt-1 text-sm text-gray-500">
            {{ pieceLabel }} برای تسویه آماده است
          </p>
        </div>
        <button
          v-if="!cartStore.loading && cartStore.items.length > 1"
          type="button"
          class="text-sm text-gray-500 underline-offset-4 hover:text-[#ef394e] hover:underline disabled:opacity-50"
          :disabled="clearing"
          @click="clearCart"
        >
          حذف همه
        </button>
      </div>

      <p v-if="shipMessage" class="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{{ shipMessage }}</p>

      <section v-if="heldItems.length" class="mb-6 rounded-3xl bg-white p-4 shadow-card sm:p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-bold text-[#3c322b]">لباس‌های خریداری‌شده</h2>
            <p class="mt-1 text-sm leading-6 text-gray-500">
              هر وقت دکمه ارسال بزنید، درخواست ارسال برای شما ثبت می‌شود.
            </p>
          </div>
        </div>
        <button
          type="button"
          class="btn-primary mt-4 h-11 px-5 text-sm"
          :disabled="requestingShip"
          @click="requestShipment"
        >
          {{ requestingShip ? 'در حال ثبت...' : 'ارسال' }}
        </button>
        <ul class="mt-4 divide-y divide-[#f0ebe8]">
          <li v-for="item in heldItems" :key="item.id" class="flex items-center justify-between gap-3 py-3 text-sm">
            <span class="min-w-0">
              <span class="block truncate font-medium text-[#3c322b]">{{ item.name }}</span>
              <span class="text-xs text-gray-400">{{ toPersianDigits(item.quantity) }} عدد · {{ item.orderNumber }}</span>
            </span>
            <span class="shrink-0 font-bold text-[#3c322b]">{{ formatPrice(item.price * item.quantity) }}</span>
          </li>
        </ul>
      </section>

      <LoadingSpinner :show="cartStore.loading && cartStore.isEmpty" />
      <p v-if="actionError" class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{{ actionError }}</p>

      <div v-if="!cartStore.isEmpty" class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <TransitionGroup name="cart-piece" tag="div" class="overflow-hidden rounded-3xl bg-white shadow-card">
          <article
            v-for="item in cartStore.items"
            :key="item.id"
            class="flex gap-3 border-b border-[#f0ebe8] p-3 last:border-b-0 sm:gap-4 sm:p-4"
            :class="busyId === item.productId ? 'opacity-60' : ''"
          >
            <NuxtLink :to="`/products/${item.slug}`" class="shrink-0">
              <img
                :src="getProductImage(item.image)"
                :alt="item.name"
                class="h-[132px] w-[100px] rounded-2xl object-cover sm:h-[168px] sm:w-[126px]"
              />
            </NuxtLink>

            <div class="flex min-w-0 flex-1 flex-col">
              <div class="flex items-start justify-between gap-2">
                <NuxtLink :to="`/products/${item.slug}`" class="min-w-0">
                  <h2 class="line-clamp-2 text-sm font-bold leading-6 text-[#3c322b] sm:text-base">
                    {{ item.name }}
                  </h2>
                </NuxtLink>
                <button
                  type="button"
                  class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs text-[#ef394e] hover:bg-red-50 disabled:opacity-50"
                  :aria-label="`حذف ${item.name}`"
                  :disabled="busyId === item.productId"
                  @click="removeItem(item.productId)"
                >
                  <AppIcon name="lucide:trash-2" size="sm" />
                  حذف
                </button>
              </div>

              <div class="mt-2 flex flex-wrap items-baseline gap-2">
                <span class="text-sm font-bold text-gray-900">{{ formatPrice(item.effectivePrice) }}</span>
                <span
                  v-if="hasDiscount(item.price, item.effectivePrice)"
                  class="text-xs text-gray-400 line-through"
                >
                  {{ formatPrice(item.price) }}
                </span>
              </div>

              <div class="mt-auto flex items-center justify-between gap-3 pt-3">
                <div class="inline-flex items-center rounded-full border border-[#e7e1de] bg-[#faf8f7]">
                  <button
                    type="button"
                    class="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 hover:bg-white disabled:opacity-40"
                    :disabled="busyId === item.productId || item.quantity <= 1"
                    aria-label="کم کردن تعداد"
                    @click="changeQuantity(item.productId, item.quantity - 1)"
                  >
                    <AppIcon name="lucide:minus" size="sm" />
                  </button>
                  <span class="w-6 text-center text-sm font-bold">{{ toPersianDigits(item.quantity) }}</span>
                  <button
                    type="button"
                    class="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 hover:bg-white disabled:opacity-40"
                    :disabled="busyId === item.productId || item.quantity >= item.stock"
                    aria-label="زیاد کردن تعداد"
                    @click="changeQuantity(item.productId, item.quantity + 1)"
                  >
                    <AppIcon name="lucide:plus" size="sm" />
                  </button>
                </div>
                <p class="text-sm font-bold text-[#3c322b]">
                  {{ formatPrice(item.subtotal) }}
                </p>
              </div>
            </div>
          </article>
        </TransitionGroup>

        <aside class="rounded-3xl bg-white p-5 shadow-card lg:sticky lg:top-24">
          <h2 class="text-base font-bold text-[#3c322b]">خلاصه سفارش</h2>
          <dl class="mt-4 space-y-3 text-sm">
            <div class="flex items-center justify-between text-gray-600">
              <dt>تعداد لباس</dt>
              <dd>{{ pieceLabel }}</dd>
            </div>
            <div v-if="discountAmount" class="flex items-center justify-between text-green-700">
              <dt>تخفیف {{ applied?.code }}</dt>
              <dd>- {{ formatPrice(discountAmount) }}</dd>
            </div>
            <div class="flex items-center justify-between border-t border-[#f0ebe8] pt-3 text-base font-bold text-[#3c322b]">
              <dt>مبلغ قابل پرداخت</dt>
              <dd>{{ formatPrice(payable(cartStore.totalPrice)) }}</dd>
            </div>
          </dl>
          <div class="mt-4">
            <CouponCodeField :subtotal="cartStore.totalPrice" />
          </div>
          <p class="mt-4 text-sm font-medium text-[#3c322b]">هزینه ارسال</p>
          <p class="mt-1 text-xs leading-6 text-gray-500">{{ nationwideHint }}</p>
          <p class="mt-2 text-xs leading-6 text-gray-500">
            سبد خرید {{ toPersianDigits(cartHoldMinutes) }} دقیقه نگه داشته می‌شود.
          </p>
          <button type="button" class="btn-primary btn-action mt-5 hidden w-full lg:inline-flex" @click="continueCheckout">
            ادامه و ثبت سفارش
          </button>
          <NuxtLink to="/categories" class="btn-secondary btn-action mt-3 hidden w-full lg:inline-flex">
            ادامه خرید
          </NuxtLink>
        </aside>
      </div>

      <EmptyCatalogScene
        v-else-if="!cartStore.loading"
        variant="cart"
        class="shadow-card"
      >
        <NuxtLink to="/categories" class="btn-primary btn-action px-8">
          دیدن کالکشن‌ها
        </NuxtLink>
      </EmptyCatalogScene>
    </div>

    <section v-if="!cartStore.isEmpty && suggestedProducts.length" class="mt-8 bg-white py-8">
      <HomeSection title="برای ست کردن" to="/categories" link-label="کالکشن‌ها" />
      <ProductCardList :products="suggestedProducts" layout="grid" density="sarak" />
    </section>

    <div
      v-if="!cartStore.isEmpty"
      class="fixed inset-x-0 bottom-16 z-40 border-t border-[#f0ebe8] bg-white/95 px-4 py-3 backdrop-blur lg:hidden"
    >
      <div class="mx-auto flex max-w-lg items-center gap-3">
        <div class="min-w-0">
          <p class="text-xs text-gray-500">قابل پرداخت</p>
          <p class="truncate text-sm font-bold text-[#3c322b]">{{ formatPrice(payable(cartStore.totalPrice)) }}</p>
        </div>
        <button type="button" class="btn-primary inline-flex h-12 flex-1 items-center justify-center rounded-xl text-sm font-bold" @click="continueCheckout">
          ادامه و ثبت سفارش
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cart-piece-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.cart-piece-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}
</style>
