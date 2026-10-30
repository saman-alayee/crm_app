<script setup lang="ts">
const { api } = useApi();
const toast = useToast();
const { formatDate } = useFormat();
const loading = ref(true);
const items = ref<any[]>([]);
const pagination = ref<any>(null);

async function load(page = 1) {
  loading.value = true;
  try {
    const res = await api<{ success: boolean; data: { items: any[]; pagination: any } }>(
      `/audit-logs?page=${page}&limit=30`
    );
    items.value = res.data.items;
    pagination.value = res.data.pagination;
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

onMounted(() => load());
useHead({ title: 'تاریخچه عملیات' });
</script>

<template>
  <div>
    <UiPageHeader
      eyebrow="امنیت"
      title="تاریخچه عملیات"
      subtitle="چه کسی، چه زمانی، چه کاری در سیستم انجام داده"
    />

    <UiHelpBanner
      storage-key="audit"
      title="راهنمای تاریخچه"
      :steps="[
        'این صفحه فقط مشاهده است — برای پیگیری تغییرات مهم.',
        'ستون «کاربر» کسی است که عملیات را انجام داده.',
        'ماژول و عملیات نشان می‌دهد روی کدام بخش چه اتفاقی افتاده.',
      ]"
    />

    <LoadingSpinner v-if="loading" />
    <EmptyState
      v-else-if="!items.length"
      title="سابقه‌ای نیست"
      message="هنوز عملیات حساسی ثبت نشده"
      tip="با استفاده از پنل، لاگ‌ها اینجا جمع می‌شوند."
      icon="lucide:scroll-text"
    />
    <div v-else class="card overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 text-gray-500">
          <tr>
            <th class="px-3 py-3 text-start">زمان</th>
            <th class="px-3 py-3 text-start">کاربر</th>
            <th class="px-3 py-3 text-start">ماژول</th>
            <th class="px-3 py-3 text-start">عملیات</th>
            <th class="px-3 py-3 text-start">رکورد</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id" class="border-t">
            <td class="px-3 py-3 whitespace-nowrap">{{ formatDate(row.createdAt) }}</td>
            <td class="px-3 py-3">
              {{ row.actor?.employee ? `${row.actor.employee.firstName} ${row.actor.employee.lastName}` : row.actor?.username || '—' }}
            </td>
            <td class="px-3 py-3">{{ row.module }}</td>
            <td class="px-3 py-3">{{ row.action }}</td>
            <td class="px-3 py-3 text-xs text-gray-500" dir="ltr">{{ row.entityType }} {{ row.entityId }}</td>
          </tr>
        </tbody>
      </table>
      <div class="p-4">
        <AppPagination :pagination="pagination" compact @update:page="load" />
      </div>
    </div>
  </div>
</template>
