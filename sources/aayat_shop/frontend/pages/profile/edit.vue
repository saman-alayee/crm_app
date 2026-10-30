<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';

definePageMeta({ layout: 'profile', middleware: 'auth' });

const authStore = useAuthStore();
const toast = useToast();

const form = reactive({
  firstName: '',
  lastName: '',
});

const loading = ref(false);
const pageLoading = ref(true);
const formError = ref('');

const initials = computed(() => {
  const fn = form.firstName.trim();
  const ln = form.lastName.trim();
  if (fn && ln) return `${fn.charAt(0)}${ln.charAt(0)}`;
  if (fn) return fn.slice(0, 2);
  return authStore.user?.phone?.slice(-2) || '؟';
});

onMounted(async () => {
  try {
    await authStore.fetchProfile();
    form.firstName = authStore.user?.firstName || '';
    form.lastName = authStore.user?.lastName || '';
  } finally {
    pageLoading.value = false;
  }
});

async function save() {
  formError.value = '';
  loading.value = true;
  try {
    await authStore.updateProfile(form);
    toast.success('اطلاعات با موفقیت ذخیره شد');
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'خطا در ذخیره';
    toast.error(formError.value);
  } finally {
    loading.value = false;
  }
}

useHead({ title: `تنظیمات حساب - ${SITE_NAME}` });
</script>

<template>
  <div>
    <ProfilePageHeader title="اطلاعات حساب" subtitle="نام و مشخصات پروفایل" back-to="/profile" />

    <LoadingSpinner :show="pageLoading" />

    <template v-if="!pageLoading">
      <div class="card p-6 mb-5 text-center">
        <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white text-2xl font-bold flex items-center justify-center mx-auto shadow-lg">
          {{ initials }}
        </div>
        <p class="text-sm text-gray-500 mt-3" dir="ltr">{{ authStore.user?.phone }}</p>
        <p class="text-xs text-gray-400 mt-1">شماره موبایل قابل تغییر نیست</p>
      </div>

      <form class="card p-5 space-y-4" @submit.prevent="save">
        <AppAlertBanner :message="formError" />

        <div>
          <label class="field-label">نام</label>
          <input v-model="form.firstName" type="text" class="input-field" placeholder="نام خود را وارد کنید" />
        </div>
        <div>
          <label class="field-label">نام خانوادگی</label>
          <input v-model="form.lastName" type="text" class="input-field" placeholder="نام خانوادگی" />
        </div>

        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? 'در حال ذخیره...' : 'ذخیره تغییرات' }}
        </button>
      </form>
    </template>
  </div>
</template>
