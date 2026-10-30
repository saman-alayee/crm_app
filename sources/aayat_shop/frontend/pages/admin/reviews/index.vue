<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();
const { toPersianDigits, formatShortDate } = useFormat();

type AdminReview = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  authorName: string;
  phone: string;
  productName: string;
  productSlug: string;
};

const reviews = ref<AdminReview[]>([]);
const page = ref(1);
const pages = ref(1);
const loading = ref(true);
const removingId = ref('');

async function load(next = page.value) {
  loading.value = true;
  try {
    const { data } = await api.get<{
      reviews: AdminReview[];
      pagination: { page: number; pages: number };
    }>(`/admin/reviews?page=${next}`);
    reviews.value = data.reviews;
    page.value = data.pagination.page;
    pages.value = data.pagination.pages;
  } finally {
    loading.value = false;
  }
}

async function remove(review: AdminReview) {
  removingId.value = review.id;
  try {
    await api.delete(`/admin/reviews/${review.id}`);
    toast.success('نظر حذف شد');
    await load(reviews.value.length === 1 && page.value > 1 ? page.value - 1 : page.value);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'حذف انجام نشد');
  } finally {
    removingId.value = '';
  }
}

onMounted(() => load(1));
useHead({ title: 'نظرات محصولات - پنل مدیریت' });
</script>

<template>
  <div>
    <h1 class="text-lg font-bold text-gray-900">نظرات محصولات</h1>
    <p class="mb-4 mt-1 max-w-2xl text-sm leading-6 text-gray-500">
      نظرهایی که مشتری زیر لباس ثبت کرده این‌جا دیده می‌شود. حذف، نظر را از صفحهٔ محصول برمی‌دارد.
    </p>
    <p v-if="loading" class="text-sm text-gray-500">در حال بارگذاری</p>
    <p v-else-if="!reviews.length" class="text-sm text-gray-500">هنوز نظری ثبت نشده است.</p>
    <div v-else class="data-table-wrap">
      <table class="data-table min-w-[800px]">
        <thead>
          <tr>
            <th>محصول</th>
            <th>مشتری</th>
            <th class="data-num">امتیاز</th>
            <th>نظر</th>
            <th>تاریخ</th>
            <th class="data-actions">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="review in reviews" :key="review.id">
            <td>
              <NuxtLink :to="`/products/${review.productSlug}`" class="font-semibold text-primary-700 hover:underline" target="_blank">
                {{ review.productName }}
              </NuxtLink>
            </td>
            <td>
              <p class="font-medium text-slate-800">{{ review.authorName }}</p>
              <p class="text-xs text-slate-400 mt-0.5" dir="ltr">{{ review.phone }}</p>
            </td>
            <td class="data-num font-semibold">{{ toPersianDigits(review.rating) }}</td>
            <td class="max-w-xs text-slate-600">{{ review.body || '—' }}</td>
            <td class="whitespace-nowrap text-slate-500">{{ formatShortDate(review.createdAt) }}</td>
            <td class="data-actions">
              <div class="admin-actions">
                <button
                  type="button"
                  class="admin-btn-danger"
                  :disabled="removingId === review.id"
                  @click="remove(review)"
                >
                  حذف
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="pages > 1" class="mt-4 flex gap-2">
      <button type="button" class="rounded border px-3 py-1 text-sm disabled:opacity-40" :disabled="page <= 1" @click="load(page - 1)">قبلی</button>
      <button type="button" class="rounded border px-3 py-1 text-sm disabled:opacity-40" :disabled="page >= pages" @click="load(page + 1)">بعدی</button>
    </div>
  </div>
</template>
