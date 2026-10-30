<script setup lang="ts">
import { rules } from '~/composables/useFormValidation';

const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const { formatNumber } = useFormat();
const { errors, clearField, validate } = useFormValidation();

const loading = ref(true);
const items = ref<any[]>([]);
const showForm = ref(false);
const rejectId = ref<string | null>(null);
const rejectReason = ref('');
const form = reactive({ type: 'ADVANCE' as 'SALARY' | 'ADVANCE', amount: '' as number | '', description: '' });

async function load() {
  loading.value = true;
  try {
    const res = await api<{ success: boolean; data: { items: any[] } }>('/salary-requests?limit=50');
    items.value = res.data.items;
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

async function create() {
  if (
    !validate(
      { ...form, amount: form.amount },
      {
        amount: [rules.required('مبلغ را وارد کنید'), rules.positiveNumber()],
      },
    )
  ) {
    toast.error('لطفاً خطاهای فرم را برطرف کنید');
    return;
  }
  try {
    await api('/salary-requests', {
      method: 'POST',
      body: { type: form.type, amount: Number(form.amount), description: form.description.trim() },
    });
    toast.success('ثبت شد');
    showForm.value = false;
    form.amount = '';
    form.description = '';
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function approve(id: string) {
  try {
    await api(`/salary-requests/${id}/approve`, { method: 'POST' });
    toast.success('تأیید شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function reject() {
  if (!rejectId.value) return;
  if (!validate({ rejectReason: rejectReason.value }, { rejectReason: [rules.required('دلیل رد را بنویسید')] })) {
    toast.error('دلیل رد الزامی است');
    return;
  }
  try {
    await api(`/salary-requests/${rejectId.value}/reject`, {
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
useHead({ title: 'حقوق و مساعده' });
</script>

<template>
  <div>
    <UiPageHeader
      eyebrow="مالی"
      title="حقوق و مساعده"
      subtitle="درخواست مالی ثبت کنید؛ مدیر تأیید یا رد می‌کند"
    >
      <template #actions>
        <button v-if="auth.can('salary.create')" class="btn-primary" type="button" @click="showForm = !showForm">
          درخواست جدید
        </button>
      </template>
    </UiPageHeader>

    <UiHelpBanner
      storage-key="salary"
      title="راهنمای مالی"
      :steps="[
        '«مساعده» یعنی پیش‌پرداخت؛ «حقوق» برای درخواست حقوق دوره‌ای است.',
        'مبلغ را به ریال وارد کنید و توضیح کوتاه بنویسید.',
        'مدیران درخواست‌های در انتظار را با تأیید یا رد جمع می‌کنند.',
      ]"
    />

    <div v-if="showForm" class="card mb-4 p-4">
      <h2 class="mb-1 font-semibold">ثبت درخواست مالی</h2>
      <p class="mb-3 text-xs" style="color: var(--hr-muted)">بعد از ثبت، برای مدیر اعلان می‌رود.</p>
      <div class="grid gap-3 md:grid-cols-3">
        <div>
          <label class="field-label">نوع</label>
          <select v-model="form.type" class="input-field">
            <option value="ADVANCE">مساعده</option>
            <option value="SALARY">حقوق</option>
          </select>
        </div>
        <div>
          <label class="field-label">مبلغ (ریال)</label>
          <input
            v-model="form.amount"
            type="number"
            min="1"
            class="input-field"
            :class="{ 'input-invalid': errors.amount }"
            placeholder="مثلاً 5000000"
            @input="clearField('amount')"
          />
          <UiFieldError :message="errors.amount" />
          <UiFieldHint text="فقط عدد وارد کنید؛ بدون ویرگول یا تومان." />
        </div>
        <div>
          <label class="field-label">توضیح</label>
          <input v-model="form.description" class="input-field" placeholder="اختیاری" maxlength="300" />
        </div>
      </div>
      <button class="btn-primary mt-4" type="button" @click="create">ثبت درخواست</button>
    </div>

    <div v-if="rejectId" class="card mb-4 p-4">
      <label class="field-label">دلیل رد</label>
      <input
        v-model="rejectReason"
        class="input-field"
        :class="{ 'input-invalid': errors.rejectReason }"
        placeholder="برای کارمند توضیح بنویسید"
        @input="clearField('rejectReason')"
      />
      <UiFieldError :message="errors.rejectReason" />
      <div class="mt-3 flex gap-2">
        <button class="btn-primary" type="button" @click="reject">ثبت رد</button>
        <button class="btn-secondary" type="button" @click="rejectId = null">انصراف</button>
      </div>
    </div>

    <LoadingSpinner v-if="loading" />
    <EmptyState
      v-else-if="!items.length"
      title="درخواست مالی نیست"
      message="هنوز چیزی ثبت نشده"
      tip="با «درخواست جدید» مساعده یا حقوق را ثبت کنید."
      icon="lucide:wallet"
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
            <p class="mt-1 text-sm text-gray-600">
              مبلغ:
              {{ typeof row.amount === 'string' ? row.amount : formatNumber(Number(row.amount)) }}
            </p>
            <p v-if="row.description" class="text-sm text-gray-500">{{ row.description }}</p>
            <p v-if="row.rejectionReason" class="text-sm text-red-600">دلیل رد: {{ row.rejectionReason }}</p>
          </div>
          <div v-if="row.status === 'PENDING'" class="flex gap-2">
            <button
              v-if="auth.can('salary.approve')"
              class="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white"
              type="button"
              @click="approve(row.id)"
            >
              تأیید
            </button>
            <button
              v-if="auth.can('salary.reject')"
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
