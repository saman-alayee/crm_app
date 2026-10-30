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
        'لاگ‌های قدیمی‌تر از ۹۰ روز (و بیش از سقف ردیف) به‌صورت خودکار پاک می‌شوند تا فضای سرور پر نشود.',
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
    <div v-else class="data-table-wrap">
      <div class="overflow-x-auto">
        <table class="data-table min-w-[720px]">
          <thead>
            <tr>
              <th>زمان</th>
              <th>کاربر</th>
              <th>ماژول</th>
              <th>عملیات</th>
              <th>رکورد</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in items" :key="row.id">
              <td class="whitespace-nowrap cell-muted">{{ formatDate(row.createdAt) }}</td>
              <td>
                {{ row.actor?.employee ? `${row.actor.employee.firstName} ${row.actor.employee.lastName}` : row.actor?.username || '—' }}
              </td>
              <td>{{ row.module }}</td>
              <td>{{ row.action }}</td>
              <td class="cell-muted cell-mono" dir="ltr">{{ row.entityType }} {{ row.entityId }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="data-table-wrap__footer">
        <AppPagination :pagination="pagination" compact @update:page="load" />
      </div>
    </div>
  </div>
</template>
