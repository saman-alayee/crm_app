<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';
import { normalizePhoneInput } from '~/utils/normalize';

const authStore = useAuthStore();
const route = useRoute();

type Step = 'phone' | 'otp';

const step = ref<Step>('phone');
const phone = ref('');
const otp = ref('');
const info = ref('');
const error = ref('');
const resendLeft = ref(0);
let resendTimer: ReturnType<typeof setInterval> | null = null;

const redirect = computed(() => (route.query.redirect as string) || '');
const resendClock = computed(() => {
  const minutes = String(Math.floor(resendLeft.value / 60)).padStart(2, '0');
  const seconds = String(resendLeft.value % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
});

function safeRedirectTarget(raw: string) {
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/profile';
  if (raw.startsWith('/admin')) return '/profile';
  return raw;
}

function clearResendTimer() {
  if (resendTimer) clearInterval(resendTimer);
  resendTimer = null;
}

function startResendTimer() {
  clearResendTimer();
  resendLeft.value = 120;
  resendTimer = setInterval(() => {
    resendLeft.value -= 1;
    if (resendLeft.value <= 0) clearResendTimer();
  }, 1000);
}

onUnmounted(clearResendTimer);

function isValidMobile(value: string) {
  return /^09\d{9}$/.test(normalizePhoneInput(value));
}

async function afterLogin() {
  await authStore.fetchProfile().catch(() => undefined);
  await nextTick();
  await navigateTo(safeRedirectTarget(redirect.value || '/profile'), { replace: true });
}

function goBack() {
  error.value = '';
  otp.value = '';
  step.value = 'phone';
  info.value = '';
}

async function sendCode() {
  error.value = '';
  if (!isValidMobile(phone.value)) {
    error.value = 'فقط شماره موبایل ۱۱ رقمی وارد کنید (مثل ۰۹۱۲۳۴۵۶۷۸۹)';
    return;
  }
  try {
    const result = await authStore.startAuth(phone.value, 'otp');
    info.value = result.message || '';
    otp.value = '';
    step.value = 'otp';
    startResendTimer();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'شماره موبایل نامعتبر است';
  }
}

async function submitCode() {
  if (authStore.loading || otp.value.length < 6) return;
  error.value = '';
  try {
    await authStore.verifyOtp(phone.value, otp.value);
    await afterLogin();
  } catch (e: unknown) {
    otp.value = '';
    error.value = e instanceof Error ? e.message : 'کد تایید نامعتبر است';
  }
}

async function resend() {
  if (resendLeft.value > 0) return;
  await sendCode();
}

watch(otp, (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  if (digits !== value) {
    otp.value = digits;
    return;
  }
  if (digits.length === 6 && step.value === 'otp') void submitCode();
});

useHead({
  title: `ورود | ثبت‌نام - ${SITE_NAME}`,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});
definePageMeta({ layout: false });
</script>

<template>
  <AuthAtelierFrame>
    <button
      v-if="step !== 'phone'"
      type="button"
      class="mb-4 inline-flex items-center gap-1 text-sm text-gray-500"
      @click="goBack"
    >
      <AppIcon name="lucide:arrow-right" size="sm" />
      بازگشت
    </button>

    <form v-if="step === 'phone'" class="space-y-4" @submit.prevent="sendCode">
      <h1 class="text-base font-semibold text-gray-900">ورود | ثبت‌نام</h1>
      <p class="text-sm text-gray-600 leading-6">
        سلام!
        <br>
        ورود فقط با شماره تلفن موبایل انجام می‌شود.
      </p>
      <input
        v-model="phone"
        type="tel"
        name="tel"
        required
        class="input-field"
        placeholder="شماره تلفن موبایل (مثل ۰۹۱۲۳۴۵۶۷۸۹)"
        dir="ltr"
        inputmode="tel"
        autocomplete="tel"
      />
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button type="submit" class="btn-primary w-full" :disabled="authStore.loading">
        {{ authStore.loading ? '...' : 'تایید' }}
      </button>
    </form>

    <form v-else class="space-y-4" @submit.prevent="submitCode">
      <h1 class="text-base font-semibold text-gray-900">کد تایید را وارد کنید</h1>
      <p class="text-xs text-gray-500">{{ info }}</p>
      <input
        v-model="otp"
        inputmode="numeric"
        maxlength="6"
        autocomplete="one-time-code"
        class="input-field text-center tracking-[0.4em]"
        dir="ltr"
      />
      <button
        type="button"
        class="text-xs text-gray-500 disabled:opacity-50"
        :disabled="resendLeft > 0 || authStore.loading"
        @click="resend"
      >
        <template v-if="resendLeft > 0">{{ resendClock }} تا ارسال مجدد</template>
        <template v-else>ارسال مجدد</template>
      </button>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button type="submit" class="btn-primary w-full" :disabled="authStore.loading">تایید</button>
      <p class="text-xs text-gray-500 leading-6">
        عضویت شما به معنای پذیرش
        <NuxtLink to="/pages/terms" class="text-primary-700 font-medium">شرایط و قوانین</NuxtLink>
        است.
      </p>
    </form>
  </AuthAtelierFrame>
</template>
