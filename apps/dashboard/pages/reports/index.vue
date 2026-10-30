<script setup lang="ts">
const { api } = useApi();
const toast = useToast();
const { formatNumber } = useFormat();
const loading = ref(true);
const items = ref<any[]>([]);

async function load() {
  loading.value = true;
  try {
    const res = await api<{ success: boolean; data: { items: any[] } }>('/reports/employees');
    items.value = res.data.items;
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

function exportCsv() {
  const header = ['name', 'username', 'leaveTotal', 'leaveApproved', 'leaveRejected', 'salaryTotal', 'tasksAssigned', 'tasksCompleted', 'tasksOverdue'];
  const lines = [header.join(',')].concat(
    items.value.map((r) =>
      [r.name, r.username, r.leaveTotal, r.leaveApproved, r.leaveRejected, r.salaryTotal, r.tasksAssigned, r.tasksCompleted, r.tasksOverdue].join(',')
    )
  );
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'employee-report.csv';
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(load);
useHead({ title: 'گزارش‌ها' });
</script>

<template>
  <div>
    <UiPageHeader
      eyebrow="تحلیل"
      title="گزارش کارکنان"
      subtitle="خلاصه مرخصی، مالی و وظایف هر نفر — قابل خروجی گرفتن"
    >
      <template #actions>
        <button class="btn-secondary" type="button" @click="exportCsv">
          <AppIcon name="lucide:download" size="sm" />
          خروجی CSV
        </button>
      </template>
    </UiPageHeader>

    <UiHelpBanner
      storage-key="reports"
      title="راهنمای گزارش"
      :steps="[
        'هر ردیف یک کارمند است با تعداد مرخصی، درخواست مالی و وظایف.',
        'ستون «عقب‌افتاده» یعنی وظایفی که از مهلت گذشته‌اند.',
        'با «خروجی CSV» فایل را در اکسل باز کنید.',
      ]"
    />

    <LoadingSpinner v-if="loading" />
    <EmptyState
      v-else-if="!items.length"
      title="گزارشی نیست"
      message="هنوز داده‌ای برای گزارش جمع نشده"
      tip="بعد از ثبت کارکنان و فعالیت‌ها، آمار اینجا می‌آید."
      icon="lucide:bar-chart-3"
    />
    <div v-else class="card overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 text-gray-500">
          <tr>
            <th class="px-3 py-3 text-start">کارمند</th>
            <th class="px-3 py-3 text-start">مرخصی</th>
            <th class="px-3 py-3 text-start">تأیید/رد</th>
            <th class="px-3 py-3 text-start">مالی</th>
            <th class="px-3 py-3 text-start">وظایف</th>
            <th class="px-3 py-3 text-start">عقب‌افتاده</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id" class="border-t">
            <td class="px-3 py-3">
              {{ row.name }}
              <span class="text-xs text-gray-400">(@{{ row.username }})</span>
            </td>
            <td class="px-3 py-3">{{ formatNumber(row.leaveTotal) }}</td>
            <td class="px-3 py-3">{{ formatNumber(row.leaveApproved) }} / {{ formatNumber(row.leaveRejected) }}</td>
            <td class="px-3 py-3">{{ formatNumber(row.salaryTotal) }}</td>
            <td class="px-3 py-3">{{ formatNumber(row.tasksCompleted) }}/{{ formatNumber(row.tasksAssigned) }}</td>
            <td class="px-3 py-3">{{ formatNumber(row.tasksOverdue) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
