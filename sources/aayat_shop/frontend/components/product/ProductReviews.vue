<script setup lang="ts">
import type { ProductReview } from '~/types';

const props = defineProps<{
  slug: string;
}>();

const api = useApi();
const auth = useAuthStore();
const toast = useToast();
const route = useRoute();
const { toPersianDigits, formatShortDate } = useFormat();

type ReviewPage = {
  summary: { ratingAvg: number; ratingCount: number };
  reviews: ProductReview[];
  pagination: { page: number; pages: number; total: number };
};

const summary = ref({ ratingAvg: 0, ratingCount: 0 });
const reviews = ref<ProductReview[]>([]);
const page = ref(1);
const pages = ref(1);
const loading = ref(true);
const saving = ref(false);
const rating = ref(0);
const body = ref('');
const hasMine = ref(false);

const loginTo = computed(() => `/auth/login?redirect=${encodeURIComponent(route.fullPath)}`);
const bodyLen = computed(() => body.value.trim().length);

async function load(nextPage = 1) {
  loading.value = true;
  try {
    const { data } = await api.get<ReviewPage>(`/products/${props.slug}/reviews?page=${nextPage}`);
    summary.value = data.summary;
    reviews.value = data.reviews;
    page.value = data.pagination.page;
    pages.value = data.pagination.pages;
  } finally {
    loading.value = false;
  }
}

async function loadMine() {
  if (!auth.isLoggedIn) {
    hasMine.value = false;
    return;
  }
  const { data } = await api.get<{ rating: number; body: string } | null>(
    `/products/${props.slug}/reviews/mine`,
  );
  if (!data) {
    hasMine.value = false;
    rating.value = 0;
    body.value = '';
    return;
  }
  hasMine.value = true;
  rating.value = data.rating;
  body.value = data.body;
}

async function submit() {
  if (!auth.isLoggedIn) return;
  if (rating.value < 1) {
    toast.error('امتیاز را انتخاب کنید');
    return;
  }
  saving.value = true;
  const wasMine = hasMine.value;
  try {
    const { data } = await api.post<{ summary: { ratingAvg: number; ratingCount: number } }>(
      `/products/${props.slug}/reviews`,
      { rating: rating.value, body: body.value },
    );
    summary.value = data.summary;
    hasMine.value = true;
    toast.success(wasMine ? 'نظر شما به‌روز شد' : 'نظر شما ثبت شد');
    await load(1);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'ثبت نظر انجام نشد');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([load(1), loadMine()]);
});
</script>

<template>
  <section class="mx-auto mt-8 max-w-[1240px] border-t border-gray-100 px-4 pb-10 pt-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 class="text-lg font-bold text-[#3c322b]">امتیاز و نظرات</h2>
        <p class="mt-1 text-xs text-neutral-500">هر کاربر برای هر محصول یک نظر می‌تواند ثبت کند؛ همه نظرات عمومی‌اند.</p>
      </div>
      <div class="flex items-center gap-3 rounded-2xl bg-[#faf8f5] px-4 py-3">
        <ProductRating :value="summary.ratingAvg" size="lg" />
        <p class="text-sm leading-6 text-neutral-600">
          <template v-if="summary.ratingCount">
            <span class="font-semibold text-[#3c322b]">{{ toPersianDigits(summary.ratingAvg.toFixed(1)) }}</span>
            از ۵
            <span class="mx-1 text-neutral-300">·</span>
            {{ toPersianDigits(summary.ratingCount) }} نظر
          </template>
          <template v-else>هنوز نظری ثبت نشده</template>
        </p>
      </div>
    </div>

    <form
      class="mt-6 max-w-2xl overflow-hidden rounded-2xl border border-[#eadfce] bg-white shadow-[0_10px_30px_rgba(73,32,45,0.05)]"
      @submit.prevent="submit"
    >
      <div class="border-b border-[#f0e7db] bg-[#faf8f5] px-5 py-4">
        <p class="text-sm font-semibold text-[#3c322b]">
          {{ hasMine ? 'نظر شما برای این محصول' : 'ثبت دیدگاه' }}
        </p>
        <p class="mt-1 text-xs text-neutral-500">
          {{ hasMine ? 'می‌توانید همان نظر را ویرایش کنید.' : 'فقط یک دیدگاه برای این محصول ثبت می‌شود.' }}
        </p>
      </div>

      <div class="px-5 py-5">
        <div v-if="auth.isLoggedIn">
          <p class="mb-2 text-xs font-medium text-neutral-500">امتیاز شما</p>
          <div class="flex gap-1.5">
            <button
              v-for="n in 5"
              :key="n"
              type="button"
              class="rounded-lg p-1 transition-transform hover:scale-105"
              :aria-label="`${toPersianDigits(n)} ستاره`"
              @click="rating = n"
            >
              <svg class="h-9 w-9" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  :fill="n <= rating ? '#c4922a' : '#ebe7e1'"
                  d="M10 1.8l2.1 4.3 4.7.7-3.4 3.3.8 4.7L10 12.6 5.8 14.8l.8-4.7L3.2 6.8l4.7-.7L10 1.8z"
                />
              </svg>
            </button>
          </div>

          <label class="mt-5 block">
            <span class="mb-2 block text-xs font-medium text-neutral-500">متن دیدگاه</span>
            <textarea
              v-model="body"
              rows="4"
              maxlength="500"
              class="w-full rounded-xl border border-[#e8e0d4] bg-[#fcfbf9] px-4 py-3 text-sm leading-7 text-[#3c322b] outline-none transition-colors focus:border-[#c4922a] focus:bg-white"
              placeholder="تجربه خرید این لباس را بنویسید"
            />
          </label>
          <div class="mt-2 flex items-center justify-between gap-3">
            <p class="text-[11px] text-neutral-400">{{ toPersianDigits(bodyLen) }} / ۵۰۰</p>
            <button
              type="submit"
              class="inline-flex h-11 items-center rounded-xl bg-[#3c322b] px-5 text-sm text-white transition-opacity disabled:opacity-60"
              :disabled="saving"
            >
              {{ saving ? 'در حال ثبت' : hasMine ? 'به‌روزرسانی نظر' : 'ثبت نظر' }}
            </button>
          </div>
        </div>
        <div v-else class="rounded-xl border border-dashed border-[#e8e0d4] bg-[#fcfbf9] px-4 py-6 text-center">
          <p class="text-sm text-neutral-600">برای ثبت دیدگاه وارد حساب شوید.</p>
          <NuxtLink
            :to="loginTo"
            class="mt-3 inline-flex h-10 items-center rounded-xl bg-primary-700 px-4 text-sm text-white"
          >
            ورود و ثبت نظر
          </NuxtLink>
        </div>
      </div>
    </form>

    <p v-if="loading" class="mt-8 text-sm text-neutral-500">در حال بارگذاری نظرات</p>
    <ul v-else-if="reviews.length" class="mt-8 space-y-3">
      <li
        v-for="review in reviews"
        :key="review.id"
        class="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-[0_4px_16px_rgba(35,37,78,0.03)]"
      >
        <div class="flex flex-wrap items-center gap-2.5">
          <p class="text-sm font-semibold text-[#3c322b]">{{ review.authorName }}</p>
          <ProductRating :value="review.rating" size="md" />
          <p class="text-xs text-neutral-400">{{ formatShortDate(review.createdAt) }}</p>
        </div>
        <p v-if="review.body" class="mt-2.5 text-sm leading-7 text-[#6e655d]">{{ review.body }}</p>
      </li>
    </ul>
    <p v-else class="mt-8 text-sm text-neutral-500">هنوز دیدگاهی برای این محصول نیست.</p>

    <div v-if="pages > 1" class="mt-5 flex gap-2">
      <button
        type="button"
        class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40"
        :disabled="page <= 1 || loading"
        @click="load(page - 1)"
      >
        قبلی
      </button>
      <button
        type="button"
        class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40"
        :disabled="page >= pages || loading"
        @click="load(page + 1)"
      >
        بعدی
      </button>
    </div>
  </section>
</template>
