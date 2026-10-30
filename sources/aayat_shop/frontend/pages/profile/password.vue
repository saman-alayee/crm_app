<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';
import { passwordPolicyError } from '~/utils/passwordPolicy';

definePageMeta({ layout: 'profile', middleware: 'auth' });

const authStore = useAuthStore();
const api = useApi();

type Mode = 'set' | 'change' | 'otp';

const mode = ref<Mode>('set');
const password = ref('');
const currentPassword = ref('');
const confirmPassword = ref('');
const otp = ref('');
const otpSent = ref(false);
const error = ref('');
const success = ref('');
const loading = ref(false);
const ready = ref(false);

const hasPassword = computed(() => Boolean(authStore.user?.hasPassword));

onMounted(async () => {
  try {
    await authStore.fetchProfile();
  } catch {
    // ignore
  } finally {
    mode.value = hasPassword.value ? 'change' : 'set';
    ready.value = true;
  }
});

function switchToOtp() {
  mode.value = 'otp';
  error.value = '';
  success.value = '';
  otpSent.value = false;
  otp.value = '';
  password.value = '';
  confirmPassword.value = '';
  currentPassword.value = '';
}

function switchToDefault() {
  mode.value = hasPassword.value ? 'change' : 'set';
  error.value = '';
  success.value = '';
  otpSent.value = false;
}

async function sendOtp() {
  error.value = '';
  loading.value = true;
  try {
    const phone = authStore.user?.phone;
    if (!phone) throw new Error('شماره موبایل یافت نشد');
    await authStore.sendOtp(phone);
    otpSent.value = true;
    success.value = 'کد تأیید ارسال شد';
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'خطا در ارسال کد';
  } finally {
    loading.value = false;
  }
}

async function submit() {
  error.value = '';
  success.value = '';

  if (password.value !== confirmPassword.value) {
    error.value = 'تکرار رمز عبور مطابقت ندارد';
    return;
  }
  const policyError = passwordPolicyError(password.value);
  if (policyError) {
    error.value = policyError;
    return;
  }
  if (mode.value === 'change' && !currentPassword.value) {
    error.value = 'رمز عبور فعلی را وارد کنید';
    return;
  }
  if (mode.value === 'otp' && !otp.value) {
    error.value = 'کد تأیید را وارد کنید';
    return;
  }

  loading.value = true;
  try {
    const payload: { password: string; currentPassword?: string; otpCode?: string } = {
      password: password.value,
    };
    if (mode.value === 'change') payload.currentPassword = currentPassword.value;
    if (mode.value === 'otp') payload.otpCode = otp.value;

    const { data } = await api.put<{ hasPassword: boolean; message: string }>('/auth/password', payload);
    success.value = data.message || 'رمز عبور ذخیره شد';
    password.value = '';
    currentPassword.value = '';
    confirmPassword.value = '';
    otp.value = '';
    otpSent.value = false;
    await authStore.fetchProfile();
    mode.value = 'change';
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'خطا در ذخیره رمز';
  } finally {
    loading.value = false;
  }
}

useHead({ title: `رمز عبور - ${SITE_NAME}` });
</script>

<template>
  <div class="w-full flex flex-col items-center">
    <div class="w-full max-w-md">
      <h1 class="section-title text-center md:text-start">رمز عبور</h1>
      <p class="text-sm text-gray-500 mb-6 text-center md:text-start">
        <template v-if="mode === 'set'">برای ورود سریع‌تر، یک رمز عبور شخصی تعیین کنید.</template>
        <template v-else-if="mode === 'change'">رمز عبور فعلی را تغییر دهید.</template>
        <template v-else>با کد پیامک، رمز عبور جدید تعیین کنید.</template>
      </p>

      <LoadingSpinner :show="!ready" />

      <form v-if="ready" class="card p-5 space-y-4 mx-auto" @submit.prevent="submit">
        <!-- Change with current password -->
        <div v-if="mode === 'change'">
          <label class="field-label">رمز فعلی</label>
          <input
            v-model="currentPassword"
            type="password"
            class="input-field"
            dir="ltr"
            autocomplete="current-password"
          />
          <button
            type="button"
            class="text-xs text-primary-600 mt-2"
            @click="switchToOtp"
          >
            رمز را فراموش کرده‌ام / می‌خواهم با پیامک ست کنم
          </button>
        </div>

        <!-- OTP set/reset flow -->
        <div v-if="mode === 'otp'" class="space-y-3">
          <p class="text-sm text-gray-600">
            کد تأیید به شماره
            <span class="font-medium" dir="ltr">{{ authStore.user?.phone }}</span>
            ارسال می‌شود.
          </p>
          <button
            v-if="!otpSent"
            type="button"
            class="btn-secondary w-full"
            :disabled="loading"
            @click="sendOtp"
          >
            {{ loading ? 'در حال ارسال...' : 'ارسال کد تأیید' }}
          </button>
          <template v-else>
            <div>
              <label class="field-label">کد تأیید</label>
              <input
                v-model="otp"
                type="text"
                maxlength="6"
                inputmode="numeric"
                class="input-field text-center tracking-widest"
                placeholder="------"
                dir="ltr"
              />
            </div>
            <button type="button" class="text-xs text-primary-600" @click="sendOtp">
              ارسال مجدد کد
            </button>
          </template>
          <button type="button" class="text-xs text-gray-500" @click="switchToDefault">
            بازگشت
          </button>
        </div>

        <!-- First-time set: no current password -->
        <div v-if="mode === 'set'" class="bg-primary-50 text-primary-800 text-sm p-3 rounded-xl">
          هنوز رمزی برای حساب شما ثبت نشده. رمز جدید را وارد کنید.
        </div>

        <div v-if="mode === 'set' || mode === 'change' || (mode === 'otp' && otpSent)">
          <div class="space-y-4">
            <div>
              <label class="field-label">رمز جدید</label>
              <input
                v-model="password"
                type="password"
                required
                minlength="8"
                class="input-field"
                placeholder="حداقل ۸ حرف، عدد، علامت و حروف بزرگ و کوچک"
                dir="ltr"
                autocomplete="new-password"
              />
            </div>

            <div>
              <label class="field-label">تکرار رمز جدید</label>
              <input
                v-model="confirmPassword"
                type="password"
                required
                minlength="8"
                class="input-field"
                dir="ltr"
                autocomplete="new-password"
              />
            </div>
          </div>
        </div>

        <div v-if="error" class="bg-red-50 text-red-600 text-sm p-3 rounded-xl">{{ error }}</div>
        <div v-if="success" class="bg-green-50 text-green-700 text-sm p-3 rounded-xl">{{ success }}</div>

        <button
          v-if="mode === 'set' || mode === 'change' || (mode === 'otp' && otpSent)"
          type="submit"
          class="btn-primary w-full"
          :disabled="loading"
        >
          {{ loading ? 'در حال ذخیره...' : mode === 'change' ? 'تغییر رمز عبور' : 'ثبت رمز عبور' }}
        </button>

        <button
          v-if="mode === 'set'"
          type="button"
          class="text-xs text-primary-600 w-full text-center"
          @click="switchToOtp"
        >
          ترجیح می‌دهم با پیامک تأیید کنم
        </button>
      </form>
    </div>
  </div>
</template>
