<script setup lang="ts">
const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const { formatNumber } = useFormat();
const items = ref<any[]>([]);
const name = ref('');
const description = ref('');

async function load() {
  const res = await api<{ success: boolean; data: any[] }>('/departments');
  items.value = res.data;
}

async function create() {
  try {
    await api('/departments', { method: 'POST', body: { name: name.value, description: description.value } });
    toast.success('دپارتمان ایجاد شد');
    name.value = '';
    description.value = '';
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function remove(id: string) {
  try {
    await api(`/departments/${id}`, { method: 'DELETE' });
    toast.success('حذف شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'حذف ممکن نیست');
  }
}

onMounted(load);
useHead({ title: 'دپارتمان‌ها' });
</script>

<template>
  <div>
    <UiPageHeader
      eyebrow="ساختار"
      title="دپارتمان‌ها"
      subtitle="واحدهای سازمانی را بسازید تا کارکنان را گروه‌بندی کنید"
    />

    <UiHelpBanner
      storage-key="departments"
      title="راهنمای دپارتمان"
      :steps="[
        'نام واحد را وارد کنید (مثال: فروش، انبار، پشتیبانی).',
        'بعد در صفحه کارکنان، هر نفر را به یک دپارتمان وصل کنید.',
        'حذف فقط وقتی ممکن است که کارمندی به آن واحد وصل نباشد.',
      ]"
    />

    <div v-if="auth.can('departments.create')" class="card mb-4 p-4">
      <h2 class="mb-1 font-semibold">افزودن دپارتمان</h2>
      <p class="mb-3 text-xs" style="color: var(--hr-muted)">نام کوتاه و واضح بهتر است.</p>
      <div class="grid gap-3 md:grid-cols-3">
        <div>
          <input v-model="name" class="input-field" placeholder="نام دپارتمان" />
        </div>
        <div>
          <input v-model="description" class="input-field" placeholder="توضیح کوتاه (اختیاری)" />
        </div>
        <button class="btn-primary" type="button" @click="create">افزودن</button>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="d in items" :key="d.id" class="card p-4">
        <div class="flex items-start justify-between">
          <div>
            <p class="font-semibold">{{ d.name }}</p>
            <p class="mt-1 text-sm" style="color: var(--hr-muted)">{{ d.description || '—' }}</p>
            <p class="mt-3 text-xs">{{ formatNumber(d.employeeCount || 0) }} کارمند</p>
          </div>
          <button
            v-if="auth.can('departments.delete')"
            class="text-xs text-red-600"
            type="button"
            @click="remove(d.id)"
          >
            حذف
          </button>
        </div>
      </div>
    </div>
    <EmptyState
      v-if="!items.length"
      title="دپارتمانی نیست"
      message="هنوز واحدی تعریف نشده"
      tip="با فرم بالا اولین دپارتمان را بسازید، بعد کارکنان را به آن وصل کنید."
      icon="lucide:building-2"
    />
  </div>
</template>
