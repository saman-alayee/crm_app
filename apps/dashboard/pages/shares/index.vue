<script setup lang="ts">
const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const { formatNumber, formatShortDate } = useFormat();

const loading = ref(true);
const items = ref<any[]>([]);

async function load() {
  loading.value = true;
  try {
    const res = await api<{ success: boolean; data: any[] }>('/shares');
    items.value = res.data;
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

function publicUrl(token: string) {
  if (!import.meta.client) return `/p/${token}`;
  return `${window.location.origin}/p/${token}`;
}

async function copy(token: string) {
  try {
    await navigator.clipboard.writeText(publicUrl(token));
    toast.success('لینک کپی شد');
  } catch {
    toast.error('کپی نشد');
  }
}

async function deactivate(id: string) {
  try {
    await api(`/shares/${id}/deactivate`, { method: 'POST' });
    toast.success('غیرفعال شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

onMounted(load);
useHead({ title: 'لینک‌های اشتراک' });
</script>

<template>
  <div>
    <AppPageNav />
    <UiPageHeader
      eyebrow="فروشگاه"
      title="لینک‌های اشتراک"
      subtitle="لینک عمومی محصولات — بدون قیمت خرید و داده حساس"
    >
      <template #actions>
        <NuxtLink v-if="auth.can('inventory.view')" class="btn-primary" to="/inventory">از موجودی بساز</NuxtLink>
      </template>
    </UiPageHeader>

    <div v-if="loading" class="empty-state empty-state--plain"><p>در حال بارگذاری…</p></div>
    <div v-else-if="!items.length" class="empty-state"><p class="empty-state__title">لینکی نیست</p></div>
    <div v-else class="grid gap-3">
      <article v-for="row in items" :key="row.id" class="card p-4">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="font-semibold">{{ row.title || 'لیست محصولات' }}</p>
            <p class="mt-1 text-xs" style="color: var(--hr-muted)">
              {{ formatNumber(row.items?.length || 0) }} کالا ·
              {{ row.isActive ? 'فعال' : 'غیرفعال' }} ·
              {{ formatShortDate(row.createdAt) }} ·
              بازدید {{ formatNumber(row._count?.events || 0) }}
            </p>
            <p class="mt-1 cell-mono text-xs" dir="ltr">{{ publicUrl(row.token) }}</p>
          </div>
          <div class="flex gap-1">
            <button class="btn-soft" type="button" @click="copy(row.token)">کپی</button>
            <button
              v-if="row.isActive && auth.can('shares.edit')"
              class="btn-ghost"
              type="button"
              @click="deactivate(row.id)"
            >
              غیرفعال
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
