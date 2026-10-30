<script setup lang="ts">
const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const { formatShortDate } = useFormat();

const loading = ref(true);
const items = ref<any[]>([]);
const employees = ref<any[]>([]);
const showForm = ref(false);
const form = reactive({
  title: '',
  description: '',
  priority: 'MEDIUM',
  assigneeId: '',
  dueAt: '',
  scheduleKind: 'ONCE',
});

async function load() {
  loading.value = true;
  try {
    const [tasks, emps] = await Promise.all([
      api<{ success: boolean; data: { items: any[] } }>('/tasks?limit=50', { cacheTtlMs: 8_000 }),
      auth.can('employees.view')
        ? api<{ success: boolean; data: { items: any[] } }>('/employees?limit=100', {
            cacheTtlMs: 30_000,
          })
        : Promise.resolve({ data: { items: [] as any[] } }),
    ]);
    items.value = tasks.data.items;
    employees.value = emps.data.items;
    if (!form.assigneeId && employees.value[0]) form.assigneeId = employees.value[0].id;
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

async function create() {
  try {
    await api('/tasks', {
      method: 'POST',
      body: {
        title: form.title,
        description: form.description,
        priority: form.priority,
        assigneeId: form.assigneeId,
        dueAt: form.dueAt || undefined,
        scheduleKind: form.scheduleKind,
      },
    });
    toast.success('وظیفه ایجاد شد');
    showForm.value = false;
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function complete(id: string) {
  try {
    await api(`/tasks/${id}/complete`, { method: 'POST' });
    toast.success('تکمیل شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function delay(id: string) {
  try {
    await api(`/tasks/${id}/delay-reminder`, { method: 'POST', body: { minutes: 60 } });
    toast.success('یادآوری یک ساعت بعد تنظیم شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

onMounted(load);
useHead({ title: 'وظایف' });
</script>

<template>
  <div>
    <UiPageHeader
      eyebrow="پیگیری کار"
      title="وظایف"
      subtitle="کار را به نفر مشخص بسپارید و وضعیت را دنبال کنید"
    >
      <template #actions>
        <button v-if="auth.can('tasks.create')" class="btn-primary" type="button" @click="showForm = !showForm">
          وظیفه جدید
        </button>
      </template>
    </UiPageHeader>

    <UiHelpBanner
      storage-key="tasks"
      title="راهنمای وظایف"
      :steps="[
        'با «وظیفه جدید» عنوان، مسئول و مهلت را مشخص کنید.',
        'اولویت «فوری» برای کارهای حیاتی است — زیاد استفاده نکنید.',
        'وقتی کار تمام شد «انجام شد» را بزنید؛ برای یادآوری بعدی «تأخیر ۱ ساعته» را بزنید.',
      ]"
    />

    <div v-if="showForm" class="card mb-4 p-4">
      <h2 class="mb-1 font-semibold">ایجاد وظیفه</h2>
      <p class="mb-3 text-xs" style="color: var(--hr-muted)">مسئول انتخاب‌شده اعلان دریافت می‌کند.</p>
      <div class="grid gap-3 md:grid-cols-2">
        <div class="md:col-span-2">
          <label class="field-label">عنوان</label>
          <input v-model="form.title" class="input-field" placeholder="مثال: چک موجودی قفسه" />
        </div>
        <div class="md:col-span-2">
          <label class="field-label">توضیح</label>
          <input v-model="form.description" class="input-field" placeholder="جزئیات اختیاری برای مسئول" />
        </div>
        <div>
          <label class="field-label">مسئول</label>
          <select v-model="form.assigneeId" class="input-field">
            <option v-for="e in employees" :key="e.id" :value="e.id">
              {{ e.firstName }} {{ e.lastName }}
            </option>
          </select>
          <UiFieldHint text="اگر لیست خالی است، اول کارکنان را ثبت کنید." />
        </div>
        <div>
          <label class="field-label">اولویت</label>
          <select v-model="form.priority" class="input-field">
            <option value="LOW">کم</option>
            <option value="MEDIUM">متوسط</option>
            <option value="HIGH">بالا</option>
            <option value="URGENT">فوری</option>
          </select>
        </div>
        <div>
          <label class="field-label">مهلت</label>
          <input v-model="form.dueAt" type="datetime-local" class="input-field" />
          <UiFieldHint text="اختیاری — برای کارهای زمان‌دار پر کنید." />
        </div>
        <div>
          <label class="field-label">زمان‌بندی</label>
          <select v-model="form.scheduleKind" class="input-field">
            <option value="ONCE">یک‌باره</option>
            <option value="HOURLY">ساعتی</option>
            <option value="DAILY">روزانه</option>
            <option value="WEEKLY">هفتگی</option>
            <option value="MONTHLY">ماهانه</option>
          </select>
          <UiFieldHint text="«یک‌باره» برای اکثر کارها کافی است." />
        </div>
      </div>
      <button class="btn-primary mt-4" type="button" @click="create">ایجاد وظیفه</button>
    </div>

    <LoadingSpinner v-if="loading" />
    <EmptyState
      v-else-if="!items.length"
      title="وظیفه‌ای نیست"
      message="هنوز کاری ثبت نشده است"
      tip="با «وظیفه جدید» اولین کار را به یک نفر بسپارید."
      icon="lucide:list-checks"
    />
    <div v-else class="space-y-3">
      <div v-for="row in items" :key="row.id" class="card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="font-semibold">
              {{ row.title }}
              <StatusBadge :status="row.priority" class="ms-2" />
              <StatusBadge :status="row.status" class="ms-1" />
            </p>
            <p class="mt-1 text-sm text-gray-500">
              مسئول: {{ row.assignee?.firstName }} {{ row.assignee?.lastName }}
              <span v-if="row.dueAt"> · مهلت {{ formatShortDate(row.dueAt) }}</span>
            </p>
            <p v-if="row.description" class="text-sm text-gray-600">{{ row.description }}</p>
          </div>
          <div v-if="row.status !== 'COMPLETED'" class="flex flex-wrap gap-2">
            <button class="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white" type="button" @click="complete(row.id)">
              انجام شد
            </button>
            <button class="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white" type="button" @click="delay(row.id)">
              تأخیر ۱ ساعته
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
