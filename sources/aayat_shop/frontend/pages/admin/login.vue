<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';

const authStore = useAuthStore();
const route = useRoute();

const mode = ref<'password' | 'otp'>('password');
const step = ref<'phone' | 'otp'>('phone');
const phone = ref('');
const otp = ref('');
const password = ref('');
const error = ref('');

const redirect = computed(() => (route.query.redirect as string) || '/admin');
const loginError = computed(() => route.query.error as string);

async function afterLogin() {
  await authStore.fetchProfile().catch(() => undefined);
  await nextTick();

  if (!authStore.isAdmin) {
    error.value = 'این حساب دسترسی ادمین ندارد';
    authStore.logout();
    return;
  }

  const raw = redirect.value || '/admin';
  const target =
    raw.startsWith('/admin') && !raw.startsWith('//') ? raw : '/admin';
  await navigateTo(target, { replace: true });
}

async function sendOtp() {
  error.value = '';
  try {
    await authStore.sendOtp(phone.value);
    step.value = 'otp';
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'خطا در ارسال کد';
  }
}

async function verifyOtp() {
  error.value = '';
  try {
    await authStore.verifyAdminOtp(phone.value, otp.value);
    await afterLogin();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'کد نامعتبر است';
  }
}

async function loginWithPassword() {
  error.value = '';
  try {
    await authStore.loginAdminWithPassword(phone.value, password.value);
    await afterLogin();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'ورود ناموفق بود';
  }
}

function switchMode(next: 'password' | 'otp') {
  mode.value = next;
  step.value = 'phone';
  error.value = '';
  otp.value = '';
  password.value = '';
}

useHead({
  title: `ورود ادمین - ${SITE_NAME}`,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});
definePageMeta({ layout: false });
</script>

<template>
  <AuthAtelierFrame variant="staff" back-label="فروشگاه">
        <h1 class="text-lg font-bold text-gray-800 mb-1">ورود پنل مدیریت</h1>
        <p class="text-sm text-gray-500 mb-4">فقط برای مدیران سیستم</p>

        <div
          v-if="loginError === 'not-admin'"
          class="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4"
        >
          حساب شما دسترسی پنل ادمین ندارد.
        </div>

        <div class="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
          <button
            type="button"
            :class="[
              'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
              mode === 'password' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500',
            ]"
            @click="switchMode('password')"
          >
            رمز عبور
          </button>
          <button
            type="button"
            :class="[
              'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
              mode === 'otp' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500',
            ]"
            @click="switchMode('otp')"
          >
            پیامک
          </button>
        </div>

        <form v-if="mode === 'password'" @submit.prevent="loginWithPassword">
          <label class="block text-sm font-medium text-gray-700 mb-1">شماره موبایل</label>
          <input
            v-model="phone"
            type="tel"
            required
            class="input-field mb-4"
            placeholder="09000000000"
            dir="ltr"
          />
          <label class="block text-sm font-medium text-gray-700 mb-1">رمز عبور</label>
          <input
            v-model="password"
            type="password"
            required
            minlength="4"
            class="input-field mb-4"
            placeholder="رمز عبور ادمین"
            dir="ltr"
          />
          <div v-if="error" class="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{{ error }}</div>
          <button type="submit" class="btn-primary w-full" :disabled="authStore.loading">
            {{ authStore.loading ? 'در حال ورود...' : 'ورود به پنل' }}
          </button>
        </form>

        <template v-else>
          <form v-if="step === 'phone'" @submit.prevent="sendOtp">
            <label class="block text-sm font-medium text-gray-700 mb-1">شماره موبایل ادمین</label>
            <input
              v-model="phone"
              type="tel"
              required
              class="input-field mb-4"
              placeholder="09000000000"
              dir="ltr"
            />
            <div v-if="error" class="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{{ error }}</div>
            <button type="submit" class="btn-primary w-full" :disabled="authStore.loading">
              {{ authStore.loading ? 'در حال ارسال...' : 'دریافت کد' }}
            </button>
          </form>

          <form v-else @submit.prevent="verifyOtp">
            <p class="text-sm text-gray-500 mb-4">
              کد تأیید ارسال شد
              <button type="button" class="text-primary-600 mr-1" @click="step = 'phone'">تغییر</button>
            </p>
            <label class="block text-sm font-medium text-gray-700 mb-1">کد تأیید</label>
            <input
              v-model="otp"
              type="text"
              required
              maxlength="6"
              inputmode="numeric"
              class="input-field mb-4 text-center text-2xl tracking-widest"
              placeholder="------"
              dir="ltr"
              autofocus
            />
            <div v-if="error" class="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{{ error }}</div>
            <button type="submit" class="btn-primary w-full" :disabled="authStore.loading">
              {{ authStore.loading ? 'در حال بررسی...' : 'ورود به پنل' }}
            </button>
          </form>
        </template>
  </AuthAtelierFrame>
</template>
