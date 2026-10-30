<script setup lang="ts">
import type { Order } from '~/types';
import { SITE_NAME } from '~/constants/site';
import { shippingLabel } from '~/constants/shipping';

definePageMeta({ layout: 'print', middleware: 'admin' });

const route = useRoute();
const api = useApi();
const { formatPrice, formatDate } = useFormat();

const order = ref<Order | null>(null);
const error = ref('');

onMounted(async () => {
  try {
    const { data } = await api.get<Order>(`/admin/orders/${route.params.id}`);
    order.value = data;
    await nextTick();
    window.print();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'سفارش یافت نشد';
  }
});

useHead({ title: computed(() => (order.value ? `فیش ${order.value.orderNumber}` : 'فیش سفارش')) });
</script>

<template>
  <div class="print-slip" dir="rtl">
    <p v-if="error" class="p-6 text-red-600">{{ error }}</p>
    <template v-else-if="order">
      <header class="mb-4 border-b-2 border-black pb-3">
        <h1 class="text-xl font-black">{{ SITE_NAME }} — فیش جمع‌آوری</h1>
        <p class="font-mono text-lg mt-1" dir="ltr">{{ order.orderNumber }}</p>
        <p class="text-sm text-gray-700">{{ formatDate(order.createdAt) }}</p>
      </header>

      <section class="mb-4 text-sm space-y-1">
        <p><b>نام مشتری:</b> {{ order.customerName }}</p>
        <p dir="ltr"><b>موبایل:</b> {{ order.customerPhone }}</p>
        <p v-if="order.addressTitle"><b>عنوان آدرس:</b> {{ order.addressTitle }}</p>
        <p><b>آدرس:</b> {{ order.deliveryAddress }}</p>
        <p><b>نوع ارسال:</b> {{ shippingLabel(order.paymentDetails?.deliveryMethod) }}</p>
        <p v-if="order.paymentDetails?.requestedShipDate">
          <b>روز مراجعه:</b> {{ formatDate(String(order.paymentDetails.requestedShipDate)) }}
        </p>
        <p v-if="order.paymentDetails?.deliveryFee != null">
          <b>هزینه ارسال:</b> {{ formatPrice(Number(order.paymentDetails.deliveryFee)) }}
        </p>
      </section>

      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b-2 border-black">
            <th class="text-start py-1">لباس</th>
            <th class="text-center py-1">تعداد</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in order.items" :key="item.id" class="border-b border-gray-300">
            <td class="py-2 font-medium">{{ item.name }}</td>
            <td class="py-2 text-center font-bold">{{ item.quantity }}</td>
          </tr>
        </tbody>
      </table>

      <p class="mt-4 text-sm font-bold">جمع: {{ formatPrice(order.totalPrice) }}</p>
      <p v-if="order.notes" class="mt-2 text-sm">یادداشت: {{ order.notes }}</p>

      <div class="no-print mt-8 flex gap-2">
        <button class="px-4 py-2 bg-black text-white rounded-lg" @click="window.print()">چاپ</button>
        <button class="px-4 py-2 border rounded-lg" @click="window.close()">بستن</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.print-slip {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px;
  font-family: Tahoma, sans-serif;
  color: #111;
}
@media print {
  .no-print {
    display: none !important;
  }
  .print-slip {
    padding: 0;
    max-width: none;
  }
}
</style>
