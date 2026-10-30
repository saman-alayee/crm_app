<script setup lang="ts">
const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const { formatShortDate } = useFormat();

const loading = ref(true);
const items = ref<any[]>([]);
const status = ref('');
const showForm = ref(false);
const rejectId = ref<string | null>(null);
const rejectReason = ref('');
const form = reactive({
  type: 'DAILY' as 'DAILY' | 'HOURLY',
  leaveDate: new Date().toISOString().slice(0, 10),
  startTime: '',
  endTime: '',
  reason: '',
});

async function load() {
  loading.value = true;
  try {
    const q = new URLSearchParams({ limit: '50' });
    if (status.value) q.set('status', status.value);
    const res = await api<{ success: boolean; data: { items: any[] } }>(`/leave-requests?${q}`, {
      cacheTtlMs: status.value ? 0 : 8_000,
    });
    items.value = res.data.items;
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

async function create() {
  try {
    await api('/leave-requests', { method: 'POST', body: { ...form } });
    toast.success('درخواست ثبت شد');
    showForm.value = false;
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'ثبت ناموفق');
  }
}

async function approve(id: string) {
  try {
    await api(`/leave-requests/${id}/approve`, { method: 'POST' });
    toast.success('تأیید شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function reject() {
  if (!rejectId.value) return;
  try {
    await api(`/leave-requests/${rejectId.value}/reject`, {
      method: 'POST',
      body: { reason: rejectReason.value },
    });
    toast.success('رد شد');
    rejectId.value = null;
    rejectReason.value = '';
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

onMounted(load);
useHead({ title: 'مرخصی' });
</script>

<template>
  <div>
    <UiPageHeader
      eyebrow="عملیات پرسنلی"
      title="درخواست‌های مرخصی"
      subtitle="مرخصی ثبت کنید؛ مدیران می‌توانند تأیید یا رد کنند"
    >
      <template #actions>
        <button v-if="auth.can('leave.create')" class="btn-primary" type="button" @click="showForm = !showForm">
          درخواست جدید
        </button>
      </template>
    </UiPageHeader>

    <UiHelpBanner
      storage-key="leave"
      title="راهنمای مرخصی"
      :steps="[
        'با «درخواست جدید» نوع روزانه یا ساعتی را انتخاب و تاریخ را بزنید.',
        'وضعیت «در انتظار» یعنی هنوز مدیر بررسی نکرده است.',
        'مدیران با دکمه‌های تأیید / رد روی هر کارت تصمیم می‌گیرند.',
      ]"
    />

    <div class="mb-4 max-w-xs">
      <label class="field-label">فیلتر وضعیت</label>
      <select v-model="status" class="input-field" @change="load()">
        <option value="">همه وضعیت‌ها</option>
        <option value="PENDING">در انتظار</option>
        <option value="APPROVED">تأییدشده</option>
        <option value="REJECTED">ردشده</option>
      </select>
      <UiFieldHint text="برای دیدن کارهای عقب‌مانده، «در انتظار» را انتخاب کنید." />
    </div>

    <div v-if="showForm" class="card mb-4 p-4">
      <h2 class="mb-1 font-semibold">ثبت درخواست مرخصی</h2>
      <p class="mb-3 text-xs" style="color: var(--hr-muted)">بعد از ثبت، درخواست برای مدیر ارسال می‌شود.</p>
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">نوع</label>
          <select v-model="form.type" class="input-field">
            <option value="DAILY">روزانه (کل روز)</option>
            <option value="HOURLY">ساعتی (بازه زمانی)</option>
          </select>
          <UiFieldHint text="اگر فقط چند ساعت لازم دارید، «ساعتی» را انتخاب کنید." />
        </div>
        <div>
          <label class="field-label">تاریخ</label>
          <input v-model="form.leaveDate" type="date" class="input-field" />
        </div>
        <div v-if="form.type === 'HOURLY'">
          <label class="field-label">از ساعت</label>
          <input v-model="form.startTime" type="time" class="input-field" />
        </div>
        <div v-if="form.type === 'HOURLY'">
          <label class="field-label">تا ساعت</label>
          <input v-model="form.endTime" type="time" class="input-field" />
        </div>
        <div class="md:col-span-2">
          <label class="field-label">توضیح (اختیاری)</label>
          <input v-model="form.reason" class="input-field" placeholder="مثال: مراجعه پزشکی" />
        </div>
      </div>
      <button class="btn-primary mt-4" type="button" @click="create">ثبت درخواست</button>
    </div>

    <div v-if="rejectId" class="card mb-4 border border-red-100 p-4">
      <label class="field-label">دلیل رد</label>
      <input v-model="rejectReason" class="input-field" placeholder="برای کارمند توضیح بنویسید" />
      <UiFieldHint text="دلیل رد برای کارمند قابل مشاهده است." />
      <div class="mt-3 flex gap-2">
        <button class="btn-primary" type="button" @click="reject">ثبت رد</button>
        <button class="btn-secondary" type="button" @click="rejectId = null">انصراف</button>
      </div>
    </div>

    <LoadingSpinner v-if="loading" />
    <EmptyState
      v-else-if="!items.length"
      title="درخواستی نیست"
      message="هنوز مرخصی‌ای با این فیلتر ثبت نشده"
      tip="با دکمه «درخواست جدید» اولین مرخصی را ثبت کنید."
      icon="lucide:calendar-days"
    />
    <div v-else class="space-y-3">
      <div v-for="row in items" :key="row.id" class="card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="font-semibold">
              {{ row.employee?.firstName }} {{ row.employee?.lastName }}
              <StatusBadge :status="row.type" class="ms-2" />
              <StatusBadge :status="row.status" class="ms-1" />
            </p>
            <p class="mt-1 text-sm text-gray-500">
              تاریخ: {{ formatShortDate(row.leaveDate) }}
              <span v-if="row.startTime"> · {{ row.startTime }} تا {{ row.endTime }}</span>
            </p>
            <p v-if="row.reason" class="mt-1 text-sm text-gray-600">{{ row.reason }}</p>
            <p v-if="row.rejectionReason" class="mt-1 text-sm text-red-600">دلیل رد: {{ row.rejectionReason }}</p>
          </div>
          <div v-if="row.status === 'PENDING'" class="flex gap-2">
            <button
              v-if="auth.can('leave.approve')"
              class="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white"
              type="button"
              @click="approve(row.id)"
            >
              تأیید
            </button>
            <button
              v-if="auth.can('leave.reject')"
              class="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white"
              type="button"
              @click="rejectId = row.id"
            >
              رد
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
