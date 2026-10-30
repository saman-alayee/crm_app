<script setup lang="ts">
import type { Order } from '~/types';
import { SITE_NAME } from '~/constants/site';
import { shippingLabel } from '~/constants/shipping';

definePageMeta({ layout: 'profile', middleware: 'auth' });

const api = useApi();
const route = useRoute();
const toast = useToast();
const { formatPrice, formatDate, getProductImage } = useFormat();

const order = ref<Order | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const { data } = await api.get<Order>(`/orders/${route.params.id}`);
    order.value = data;
  } finally {
    loading.value = false;
  }
});

async function copyOrderNumber() {
  if (!order.value) return;
  try {
    await navigator.clipboard.writeText(order.value.orderNumber);
    toast.success('شماره سفارش کپی شد');
  } catch {
    toast.info(order.value.orderNumber);
  }
}

useHead({ title: `جزئیات سفارش - ${SITE_NAME}` });
</script>

<template>
  <div>
    <LoadingSpinner :show="loading" />

    <template v-if="order">
      <ProfilePageHeader
        title="جزئیات سفارش"
        :subtitle="order.orderNumber"
        back-to="/profile/orders"
      >
        <template #action>
          <button
            class="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50"
            title="کپی شماره سفارش"
            @click="copyOrderNumber"
          >
            <AppIcon name="lucide:copy" size="md" />
          </button>
        </template>
      </ProfilePageHeader>

      <OrderStatusStepper :status="order.status" />

      <div class="grid gap-3 mb-4">
        <div class="card p-4">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <AppIcon name="lucide:map-pin" size="md" class="text-blue-600" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-500 mb-1">آدرس تحویل</p>
              <p v-if="order.addressTitle" class="text-sm font-semibold text-gray-800">{{ order.addressTitle }}</p>
              <p class="text-sm text-gray-800 leading-relaxed">{{ order.deliveryAddress }}</p>
              <p class="text-xs text-gray-500 mt-2">{{ order.customerName }} · {{ order.customerPhone }}</p>
            </div>
          </div>
        </div>

        <div class="card p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
              <AppIcon name="lucide:clock" size="md" class="text-gray-500" />
            </div>
            <div>
              <p class="text-xs text-gray-500">تاریخ ثبت</p>
              <p class="text-sm font-medium text-gray-800">{{ formatDate(order.createdAt) }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card p-4 mb-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <AppIcon name="lucide:shopping-basket" size="sm" />
          اقلام سفارش
        </h2>
        <div class="space-y-3 divide-y divide-gray-50">
          <div v-for="item in order.items" :key="item.id" class="flex items-center gap-3 pt-3 first:pt-0">
            <div class="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
              <img
                :src="getProductImage(item.product?.image ?? null)"
                :alt="item.name"
                class="w-full h-full object-cover"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate">{{ item.name }}</p>
              <p class="text-xs text-gray-400 mt-0.5">{{ item.quantity }} عدد × {{ formatPrice(item.price) }}</p>
            </div>
            <p class="text-sm font-bold text-gray-800 shrink-0">
              {{ formatPrice(item.subtotal || item.price * item.quantity) }}
            </p>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <div v-if="order.subtotal && order.discountAmount" class="space-y-2 text-sm mb-3 pb-3 border-b border-gray-100">
          <div class="flex justify-between text-gray-500">
            <span>جمع کالاها</span>
            <span>{{ formatPrice(order.subtotal) }}</span>
          </div>
          <div v-if="order.couponCode" class="flex justify-between text-green-600">
            <span>تخفیف ({{ order.couponCode }})</span>
            <span>- {{ formatPrice(order.discountAmount) }}</span>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="font-semibold text-gray-800">مبلغ قابل پرداخت</span>
          <span class="text-lg font-bold text-primary-700">{{ formatPrice(order.totalPrice) }}</span>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          نوع ارسال: {{ shippingLabel(order.paymentDetails?.deliveryMethod) }}
          <template v-if="order.paymentDetails?.deliveryFee != null">
            · {{ formatPrice(Number(order.paymentDetails.deliveryFee)) }}
          </template>
        </p>
      </div>

      <div v-if="order.notes" class="card p-4 mt-3">
        <p class="text-xs text-gray-500 mb-1">توضیحات</p>
        <p class="text-sm text-gray-700">{{ order.notes }}</p>
      </div>
    </template>
  </div>
</template>
