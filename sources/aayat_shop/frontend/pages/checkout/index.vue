<script setup lang="ts">
import type { Address } from '~/types';
import { normalizePhoneInput } from '~/utils/normalize';
import { SITE_NAME } from '~/constants/site';
import { type ShippingMethod } from '~/constants/shipping';
import { useOrdersStore } from '~/stores/orders';

const route = useRoute();
const cartStore = useCartStore();
const ordersStore = useOrdersStore();
const authStore = useAuthStore();
const api = useApi();
const toast = useToast();
const { formatPrice } = useFormat();
const { shippingOptions, feeFor, loadShippingSettings } = useShippingSettings();
const manualAddress = useAddressFields();
const { street, plaque, unit, province, city, postalCode, cityOptions, errors: addressErrors, validate: validateAddress, payload: manualPayload, loadFromAddress } = manualAddress;

const form = reactive({
  customerName: '',
  customerPhone: '',
  notes: '',
  deliveryMethod: 'NATIONWIDE' as ShippingMethod,
});
const { applied, discountAmount, refresh } = useCoupon();

const loading = ref(false);
const error = ref('');
const nameError = ref('');
const phoneError = ref('');
const addressesLoading = ref(false);

const displayDiscount = computed(() => discountAmount.value);
const deliveryFee = computed(() => feeFor(form.deliveryMethod));
const displayTotal = computed(() => Math.max(0, cartStore.totalPrice - displayDiscount.value) + deliveryFee.value);

function scrollToFirstError() {
  nextTick(() => {
    document.querySelector('[data-field-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

onMounted(async () => {
  void loadShippingSettings();
  if (route.query.payment === 'failed') {
    error.value = 'پرداخت زیبال انجام نشد. اگر مبلغی کم شده باشد به حساب برمی‌گردد. می‌توانید دوباره پرداخت کنید.';
  }

  authStore.init();
  if (!authStore.isLoggedIn) {
    await navigateTo(`/auth/login?redirect=${encodeURIComponent('/checkout')}`);
    return;
  }

  await cartStore.fetchCart();
  if (cartStore.isEmpty && route.query.payment !== 'failed') {
    await navigateTo('/cart');
    return;
  }

  await authStore.fetchProfile().catch(() => undefined);
  if (authStore.user) {
    form.customerName = authStore.fullName;
    form.customerPhone = authStore.user.phone;
  }
  await loadAddresses();
  await refresh(cartStore.totalPrice, form.customerPhone);
});

watch(
  () => cartStore.totalPrice,
  (subtotal) => {
    void refresh(subtotal, form.customerPhone);
  }
);

async function loadAddresses() {
  addressesLoading.value = true;
  try {
    const { data } = await api.get<Address[]>('/addresses');
    const saved = data.find((item) => item.isDefault) || data[0];
    if (saved) loadFromAddress(saved);
  } catch {
    // مشخصات را خود کاربر وارد می‌کند
  } finally {
    addressesLoading.value = false;
  }
}

async function submitOrder() {
  error.value = '';
  nameError.value = '';
  phoneError.value = '';

  const problems: string[] = [];
  if (form.customerName.trim().length < 3) {
    nameError.value = 'نام و نام خانوادگی حداقل ۳ حرف باشد';
    problems.push(nameError.value);
  }
  const phone = normalizePhoneInput(form.customerPhone);
  form.customerPhone = phone;
  if (!/^09\d{9}$/.test(phone)) {
    phoneError.value = phone
      ? `موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد؛ الان ${phone.length.toLocaleString('fa-IR')} رقم است`
      : 'شماره موبایل را وارد کنید';
    problems.push(phoneError.value);
  }

  if (!validateAddress()) {
    problems.push(
      ...[addressErrors.province, addressErrors.city, addressErrors.street, addressErrors.plaque, addressErrors.unit, addressErrors.postalCode].filter(
        (item): item is string => Boolean(item)
      )
    );
  }

  if (problems.length) {
    error.value = problems.join('\n');
    toast.error(problems[0]);
    scrollToFirstError();
    return;
  }

  loading.value = true;
  try {
    const payload = {
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      notes: form.notes.trim() || undefined,
      couponCode: applied.value?.code || undefined,
      deliveryMethod: form.deliveryMethod,
      ...manualPayload(),
    };

    const { data } = await api.post<{ orderNumber: string; paymentUrl?: string }>('/orders', {
      ...payload,
      paymentMethod: 'ZIBAL',
    });
    if (data.paymentUrl) {
      window.location.href = data.paymentUrl;
      return;
    }
    await cartStore.fetchCart();
    await ordersStore.fetchCount();
    navigateTo(`/orders/success?number=${data.orderNumber}`);
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'خطا در ثبت سفارش';
    toast.error(error.value);
  } finally {
    loading.value = false;
  }
}

useHead({
  title: `ثبت سفارش - ${SITE_NAME}`,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});
</script>

<template>
  <div class="px-4 py-4 max-w-lg md:max-w-2xl mx-auto pb-44 md:pb-32">
    <h1 class="section-title">ثبت سفارش</h1>

    <div class="card p-4 mb-4 space-y-2">
      <div class="flex justify-between text-sm">
        <span class="text-gray-600">{{ cartStore.totalItems }} کالا</span>
        <span>{{ formatPrice(cartStore.totalPrice) }}</span>
      </div>
      <div v-if="displayDiscount" class="flex justify-between text-sm text-green-600">
        <span>تخفیف</span><span>- {{ formatPrice(displayDiscount) }}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span>هزینه ارسال</span><span>{{ formatPrice(deliveryFee) }}</span>
      </div>
      <CouponCodeField class="pt-2" :subtotal="cartStore.totalPrice" :phone="form.customerPhone" />
      <div class="flex justify-between pt-2 border-t font-bold">
        <span>مبلغ قابل پرداخت</span>
        <span class="text-lg">{{ formatPrice(displayTotal) }}</span>
      </div>
    </div>

    <form class="space-y-4" @submit.prevent="submitOrder">
      <div>
        <label class="field-label">نام و نام خانوادگی</label>
        <input v-model="form.customerName" type="text" required minlength="3" class="input-field" :class="{ 'input-invalid': nameError }" />
        <AppFormError :message="nameError" />
      </div>
      <div>
        <label class="field-label">شماره موبایل</label>
        <input v-model="form.customerPhone" type="tel" required class="input-field" :class="{ 'input-invalid': phoneError }" dir="ltr" placeholder="۰۹۱۲۳۴۵۶۷۸۹" />
        <AppFormError :message="phoneError" />
      </div>

      <div class="space-y-3">
        <LoadingSpinner :show="addressesLoading" />
        <AddressFields
          v-model:street="street"
          v-model:plaque="plaque"
          v-model:unit="unit"
          v-model:province="province"
          v-model:city="city"
          v-model:postal-code="postalCode"
          :city-options="cityOptions"
          :errors="addressErrors"
        />
      </div>

      <div class="space-y-1">
        <p class="field-label">هزینه ارسال</p>
        <p class="text-xs leading-6 text-gray-500">
          بعد از پرداخت، لباس در سبد می‌ماند. هر وقت دکمه ارسال بزنید، درخواست ارسال برای شما ثبت می‌شود.
        </p>
        <label
          v-for="option in shippingOptions"
          :key="option.value"
          class="flex cursor-pointer items-center justify-between gap-4 border-b border-neutral-200 py-3"
        >
          <span>
            <span class="block text-sm text-neutral-900">{{ option.label }}</span>
            <span class="mt-0.5 block text-xs text-neutral-500">
              {{ option.hint }}<template v-if="option.fee"> — {{ formatPrice(option.fee) }}</template>
            </span>
          </span>
          <input v-model="form.deliveryMethod" type="radio" :value="option.value" />
        </label>
      </div>

      <div>
        <label class="field-label">توضیحات</label>
        <textarea v-model="form.notes" rows="2" class="input-field resize-none" />
      </div>

      <AppAlertBanner v-if="error" :message="error" />
    </form>

    <div class="fixed bottom-16 md:bottom-0 inset-x-0 z-[55] border-t bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur">
      <div v-if="error" class="mx-auto mb-2 max-w-lg md:max-w-2xl md:hidden"><AppAlertBanner :message="error" /></div>
      <div class="mx-auto max-w-lg md:max-w-2xl">
        <button type="button" class="btn-primary btn-action w-full" :disabled="loading" @click="submitOrder">
          {{ loading ? 'در حال اتصال به زیبال...' : `پرداخت با زیبال • ${formatPrice(displayTotal)}` }}
        </button>
      </div>
    </div>
  </div>
</template>
