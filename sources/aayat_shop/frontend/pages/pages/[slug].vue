<script setup lang="ts">
const route = useRoute();
const api = useApi();
const { formatShortDate } = useFormat();

const slug = computed(() => String(route.params.slug || ''));
const page = ref<{ title: string; body: string; updatedAt: string } | null>(null);
const loading = ref(true);
const error = ref('');

async function loadPage() {
  if (!slug.value) return;
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get<typeof page.value>(`/content/${slug.value}`);
    page.value = data;
  } catch (e: unknown) {
    page.value = null;
    error.value = e instanceof Error ? e.message : 'صفحه یافت نشد';
  } finally {
    loading.value = false;
  }
}

watch(slug, loadPage, { immediate: true });

onActivated(loadPage);

useHead(() => ({ title: page.value?.title || 'صفحه' }));
</script>

<template>
  <div class="px-4 py-4 max-w-3xl mx-auto pb-24">
    <LoadingSpinner :show="loading" />

    <div v-if="error && !loading" class="text-center text-red-500 py-12">{{ error }}</div>

    <article v-else-if="page && !loading" class="card p-6">
      <h1 class="text-xl font-bold text-gray-800 mb-4">{{ page.title }}</h1>
      <div class="prose prose-sm max-w-none text-gray-700 leading-7" v-html="renderContentHtml(page.body)" />
      <p class="text-xs text-gray-400 mt-6">آخرین به‌روزرسانی: {{ formatShortDate(page.updatedAt) }}</p>
    </article>
  </div>
</template>
