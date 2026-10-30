<script setup lang="ts">
import type { ContentPage } from '~/types';
import { SITE_NAME } from '~/constants/site';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();

const DEFAULT_TERMS = `# قوانین و مقررات ${SITE_NAME}

## ۱. ثبت سفارش
- ثبت سفارش به منزله پذیرش قیمت‌ها و شرایط فروشگاه است.
- حداقل مبلغ سفارش طبق شرایط روز محاسبه می‌شود.

## ۲. ارسال و تحویل
- ارسال سفارش‌ها در ساعات کاری انجام می‌شود.
- پرداخت در محل (پس از تحویل) انجام می‌شود.

## ۳. مرجوعی
- لباس استفاده‌نشده را طبق هماهنگی با پشتیبانی می‌توان پیگیری کرد.

## ۴. تماس
- از طریق پشتیبانی فروشگاه با ما در ارتباط باشید.`;

const pages = ref<ContentPage[]>([]);
const loading = ref(true);
const saving = ref(false);
const editing = ref<ContentPage | null>(null);
const form = reactive({ title: '', body: '', isPublished: true });
const formError = ref('');
const savedSnapshot = ref('');

const isDirty = computed(
  () =>
    !!editing.value &&
    JSON.stringify({ title: form.title, body: form.body, isPublished: form.isPublished }) !== savedSnapshot.value,
);

onMounted(() => {
  loadPages();
  window.addEventListener('keydown', onHotkey);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onHotkey);
});

function onHotkey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (isDirty.value && !saving.value) savePage();
  }
}

async function loadPages() {
  loading.value = true;
  try {
    const { data } = await api.get<ContentPage[]>('/admin/content');
    pages.value = data;

    if (!data.length) {
      await ensureTermsPage();
      return;
    }

    const terms = data.find((p) => p.slug === 'terms') || data[0];
    selectPage(terms);
  } finally {
    loading.value = false;
  }
}

async function ensureTermsPage() {
  const { data } = await api.put<ContentPage>('/admin/content/terms', {
    title: 'قوانین و مقررات',
    body: DEFAULT_TERMS,
    isPublished: true,
  });
  pages.value = [data];
  selectPage(data);
  toast.success('صفحه قوانین ایجاد شد');
}

function rememberSaved() {
  savedSnapshot.value = JSON.stringify({
    title: form.title,
    body: form.body,
    isPublished: form.isPublished,
  });
}

function selectPage(page: ContentPage) {
  if (editing.value && page.slug !== editing.value.slug && isDirty.value) {
    if (!confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) return;
  }
  editing.value = page;
  form.title = page.title;
  form.body = page.body;
  form.isPublished = page.isPublished;
  rememberSaved();
}

async function savePage() {
  if (!editing.value) return;
  formError.value = '';
  saving.value = true;
  try {
    const { data } = await api.put<ContentPage>(`/admin/content/${editing.value.slug}`, {
      title: form.title,
      body: form.body,
      isPublished: form.isPublished,
    });
    toast.success('تغییرات ذخیره شد و در سایت اعمال شد');
    editing.value = data;
    form.title = data.title;
    form.body = data.body;
    form.isPublished = data.isPublished;
    rememberSaved();
    const idx = pages.value.findIndex((p) => p.slug === data.slug);
    if (idx >= 0) pages.value[idx] = data;
    else pages.value.unshift(data);
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'خطا در ذخیره';
    toast.error(formError.value);
  } finally {
    saving.value = false;
  }
}

useHead({ title: 'قوانین و محتوا - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-xl font-bold text-gray-800">قوانین و محتوا</h1>
      <p class="text-sm text-gray-500 mt-1">
        متن صفحهٔ «قوانین و مقررات» فروشگاه را اینجا بنویسید. بعد از ذخیره، همان متن برای مشتری نمایش داده می‌شود. تا «ذخیره» را نزنید، سایت عوض نمی‌شود.
      </p>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading && editing" class="grid lg:grid-cols-[240px_1fr] gap-4">
      <div class="card p-3 space-y-1">
        <p class="text-xs text-gray-400 px-3 pb-2">صفحات</p>
        <button
          v-for="page in pages"
          :key="page.slug"
          type="button"
          :class="[
            'w-full text-start px-3 py-2 rounded-lg text-sm',
            editing.slug === page.slug ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50',
          ]"
          @click="selectPage(page)"
        >
          {{ page.title }}
          <span class="block text-[10px] text-gray-400 mt-0.5" dir="ltr">/pages/{{ page.slug }}</span>
        </button>
        <NuxtLink
          :to="`/pages/${editing.slug}`"
          target="_blank"
          class="block text-xs text-primary-600 px-3 pt-3"
        >
          مشاهده در سایت ↗
        </NuxtLink>
      </div>

      <div class="card p-4 space-y-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-bold text-gray-800">ویرایش: {{ editing.title }}</h2>
          <span
            :class="[
              'text-xs px-2 py-1 rounded-full',
              form.isPublished ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500',
            ]"
          >
            {{ form.isPublished ? 'منتشر شده' : 'پیش‌نویس' }}
          </span>
        </div>

        <AppAlertBanner :message="formError" />

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">عنوان صفحه</label>
          <input v-model="form.title" class="input-field" placeholder="مثلاً قوانین و مقررات" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">متن قوانین / محتوا</label>
          <p class="text-xs text-gray-400 mb-2">
            می‌توانید از Markdown ساده استفاده کنید:
            <code># عنوان</code> ،
            <code>## زیرعنوان</code> ،
            <code>- مورد</code> ،
            و جدول با <code>| ستون | ستون |</code>
          </p>
          <textarea
            v-model="form.body"
            rows="16"
            class="input-field font-mono text-sm resize-y min-h-[280px]"
            placeholder="متن قوانین و مقررات را اینجا بنویسید..."
          />
        </div>

        <div>
          <p class="text-sm font-medium text-gray-700 mb-2">پیش‌نمایش در سایت</p>
          <div class="rounded-xl border border-gray-100 bg-gray-50 p-4 text-gray-700 leading-7 text-sm">
            <h3 class="text-lg font-bold text-gray-800 mb-3">{{ form.title || 'بدون عنوان' }}</h3>
            <div v-html="renderContentHtml(form.body || '')" />
          </div>
        </div>

        <AppSwitch
          v-model="form.isPublished"
          label="منتشر شده در سایت"
          description="اگر خاموش باشد، صفحه برای کاربران نمایش داده نمی‌شود"
        />

        <div class="flex flex-wrap items-center gap-3">
          <button class="btn-primary w-full sm:w-auto" :disabled="saving || !isDirty" @click="savePage">
            {{ saving ? 'در حال ذخیره...' : 'ذخیره و نمایش در سایت' }}
          </button>
          <span v-if="isDirty" class="text-xs text-amber-600">تغییرات ذخیره‌نشده — Ctrl+S</span>
          <span v-else class="text-xs text-gray-400">آخرین نسخه ذخیره شده است</span>
        </div>
      </div>
    </div>

    <div v-if="!loading && !pages.length" class="card p-8 text-center">
      <p class="text-gray-500 mb-4">هنوز صفحه‌ای تعریف نشده است</p>
      <button class="btn-primary" @click="ensureTermsPage">ایجاد صفحه قوانین و مقررات</button>
    </div>
  </div>
</template>
