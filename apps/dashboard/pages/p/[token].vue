<script setup lang="ts">
definePageMeta({ layout: false, auth: false });

const route = useRoute();
const config = useRuntimeConfig();
const loading = ref(true);
const error = ref('');
const data = ref<{ title: string; items: any[] } | null>(null);

function specsText(row: any) {
  const s = row.specs || {};
  if (row.productKind === 'SIM') return [s.operator, s.type, s.plan].filter(Boolean).join(' / ');
  return [s.brand, s.model, s.storage, s.color].filter(Boolean).join(' / ');
}

onMounted(async () => {
  try {
    const token = String(route.params.token || '');
    const base = String(config.public.apiBase || '/api/v1').replace(/\/$/, '');
    const res = await fetch(`${base}/public/share/${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'لینک معتبر نیست');
    data.value = json.data;
  } catch (e: any) {
    error.value = e?.message || 'خطا';
  } finally {
    loading.value = false;
  }
});

useHead({ title: 'لیست محصولات' });
</script>

<template>
  <div class="min-h-screen px-4 py-8" style="background: var(--hr-bg, #eef3f6); color: var(--hr-text, #132533)">
    <div class="mx-auto max-w-lg">
      <div class="mb-6 text-center">
        <p class="text-sm opacity-70">فروشگاه سامی</p>
        <h1 class="mt-1 text-xl font-bold">{{ data?.title || 'محصولات' }}</h1>
      </div>

      <div v-if="loading" class="rounded-2xl bg-white p-8 text-center shadow-sm">در حال بارگذاری…</div>
      <div v-else-if="error" class="rounded-2xl bg-white p-8 text-center text-red-600 shadow-sm">{{ error }}</div>
      <div v-else-if="!data?.items?.length" class="rounded-2xl bg-white p-8 text-center shadow-sm">کالایی برای نمایش نیست</div>
      <div v-else class="space-y-3">
        <article v-for="item in data.items" :key="item.id" class="rounded-2xl bg-white p-4 shadow-sm">
          <p class="font-semibold">
            {{ item.productKind === 'SIM' ? 'سیم‌کارت' : 'گوشی' }} · {{ specsText(item) }}
          </p>
          <p class="mt-1 text-sm opacity-70">
            موجودی: {{ item.quantity }}
            <span v-if="item.sellPrice"> · قیمت: {{ Number(item.sellPrice).toLocaleString('fa-IR') }}</span>
          </p>
          <p v-if="item.note" class="mt-1 text-xs opacity-60">{{ item.note }}</p>
        </article>
      </div>
    </div>
  </div>
</template>
