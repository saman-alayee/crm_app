<script setup lang="ts">
import type { Order } from '~/types';
import { SITE_NAME } from '~/constants/site';

const route = useRoute();
const api = useApi();
const orderNumber = route.query.number as string;
const paid = ref<boolean | null>(null);

onMounted(async () => {
  if (!orderNumber) {
    paid.value = false;
    return;
  }
  try {
    const { data } = await api.get<Order>(`/orders/track/${encodeURIComponent(orderNumber)}`);
    paid.value = data.status !== 'CANCELLED' && data.status !== 'REVIEWING';
  } catch {
    paid.value = route.query.paid === '1';
  }
});

useHead({
  title: `سفارش ثبت شد - ${SITE_NAME}`,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});
</script>

<template>
  <div class="px-4 py-8 max-w-lg mx-auto text-center pb-24">
    <div class="relative mx-auto w-48 h-48 mb-6">
      <div class="absolute inset-0 bg-primary-50 rounded-full animate-pulse" />
      <div class="relative flex flex-col items-center justify-center h-full">
        <div
          class="w-16 h-16 rounded-full flex items-center justify-center mb-2"
          :class="paid === false ? 'bg-red-100' : 'bg-green-100'"
        >
          <AppIcon
            :name="paid === false ? 'lucide:circle-x' : 'lucide:circle-check'"
            size="xl"
            class="w-8 h-8"
            :class="paid === false ? 'text-red-600' : 'text-green-600'"
          />
        </div>
        <AppIcon v-if="paid !== false" name="lucide:truck" size="xl" class="text-primary-600 w-10 h-10" />
      </div>
    </div>

    <h1 class="text-2xl font-bold text-gray-800 mb-2">{{ paid === false ? 'پرداخت انجام نشد' : 'پرداخت ثبت شد' }}</h1>
    <p v-if="paid === false" class="text-gray-600 mb-6 leading-relaxed">پرداخت در زیبال ناموفق بود و سفارش لغو شد. لباس‌ها به سبد برگشته‌اند و می‌توانید دوباره پرداخت کنید.</p>
    <template v-else>
      <p class="text-gray-600 mb-2 leading-relaxed">لباس‌ها در سبد خرید ذخیره شدند و هنوز ارسال نشده‌اند.</p>
      <p class="text-sm text-primary-700 font-medium mb-6">هر وقت دکمه ارسال بزنید، درخواست ارسال برای شما ثبت می‌شود.</p>
    </template>

    <div v-if="orderNumber" class="card p-4 mb-6">
      <p class="text-sm text-gray-500 mb-1">شماره سفارش</p>
      <p class="text-xl font-bold text-primary-600" dir="ltr">{{ orderNumber }}</p>
    </div>

    <div v-if="paid !== false" class="bg-green-50 text-green-900 text-sm p-4 rounded-xl mb-6 leading-relaxed text-start">
      پول پرداخت شده است. از سبد خرید دکمهٔ «ارسال» را بزنید تا درخواست ارسال ثبت شود.
    </div>

    <div class="mx-auto max-w-lg space-y-3 md:max-w-md">
      <NuxtLink v-if="paid === false" to="/checkout" class="btn-primary btn-action w-full">تلاش دوباره</NuxtLink>
      <NuxtLink v-else to="/cart" class="btn-primary btn-action w-full">رفتن به سبد خرید</NuxtLink>
      <NuxtLink to="/" class="btn-secondary btn-action w-full">ادامه خرید</NuxtLink>
    </div>
  </div>
</template>
