<script setup lang="ts">
const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const { formatNumber } = useFormat();

const tab = ref<'sources' | 'options' | 'report' | 'edits'>('sources');
const sources = ref<any[]>([]);
const options = ref<any[]>([]);
const report = ref<{ items: any[]; unassigned: number } | null>(null);
const edits = ref<any[]>([]);
const sourceName = ref('');
const optForm = reactive({ kind: 'PHONE' as 'PHONE' | 'SIM', category: 'brand', value: '' });

async function load() {
  try {
    const [s, o] = await Promise.all([
      api<{ success: boolean; data: any[] }>('/sources'),
      api<{ success: boolean; data: any[] }>('/options'),
    ]);
    sources.value = s.data;
    options.value = o.data;
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function loadReport() {
  try {
    const res = await api<{ success: boolean; data: any }>('/sources/report/unique-customers');
    report.value = res.data;
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function loadEdits() {
  try {
    const res = await api<{ success: boolean; data: any[] }>('/edit-history?unacked=1');
    edits.value = res.data;
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function addSource() {
  if (!sourceName.value.trim()) return;
  try {
    await api('/sources', { method: 'POST', body: { name: sourceName.value.trim() } });
    sourceName.value = '';
    toast.success('ثبت شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function toggleSource(s: any) {
  try {
    await api(`/sources/${s.id}`, { method: 'PUT', body: { isActive: !s.isActive } });
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function addOption() {
  if (!optForm.value.trim()) return;
  try {
    await api('/options', { method: 'POST', body: { ...optForm, value: optForm.value.trim() } });
    optForm.value = '';
    toast.success('گزینه ثبت شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function toggleOption(o: any) {
  try {
    await api(`/options/${o.id}`, { method: 'PUT', body: { isActive: !o.isActive } });
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function ack(id: string) {
  try {
    await api(`/edit-history/${id}/ack`, { method: 'POST' });
    toast.success('تأیید شد');
    await loadEdits();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

watch(tab, (v) => {
  if (v === 'report') loadReport();
  if (v === 'edits') loadEdits();
});

onMounted(load);
useHead({ title: 'تنظیمات فروشگاه' });
</script>

<template>
  <div>
    <AppPageNav />
    <UiPageHeader eyebrow="فروشگاه" title="تنظیمات فروشگاه" subtitle="منبع جذب، گزینه‌های گوشی/سیم، گزارش و تأیید ویرایش‌ها" />

    <div class="mb-4 flex flex-wrap gap-2">
      <button type="button" class="filter-chip" :class="{ 'is-active': tab === 'sources' }" @click="tab = 'sources'">
        منابع جذب
      </button>
      <button type="button" class="filter-chip" :class="{ 'is-active': tab === 'options' }" @click="tab = 'options'">
        گزینه‌ها
      </button>
      <button
        v-if="auth.can('reports.view')"
        type="button"
        class="filter-chip"
        :class="{ 'is-active': tab === 'report' }"
        @click="tab = 'report'"
      >
        گزارش مشتری یکتا
      </button>
      <button
        v-if="auth.can('trades.approve')"
        type="button"
        class="filter-chip"
        :class="{ 'is-active': tab === 'edits' }"
        @click="tab = 'edits'"
      >
        ویرایش‌های حساس
      </button>
    </div>

    <div v-if="tab === 'sources'" class="card p-4">
      <div v-if="auth.can('sources.create')" class="mb-3 flex gap-2">
        <input v-model="sourceName" class="input-field" placeholder="نام منبع جدید" />
        <button class="btn-primary" type="button" @click="addSource">افزودن</button>
      </div>
      <ul class="space-y-2">
        <li v-for="s in sources" :key="s.id" class="flex items-center justify-between gap-2 text-sm">
          <span>{{ s.name }} <span v-if="!s.isActive" class="opacity-60">(غیرفعال)</span></span>
          <button v-if="auth.can('sources.edit')" class="btn-ghost" type="button" @click="toggleSource(s)">
            {{ s.isActive ? 'غیرفعال' : 'فعال' }}
          </button>
        </li>
      </ul>
    </div>

    <div v-else-if="tab === 'options'" class="card p-4">
      <div v-if="auth.can('options.edit')" class="mb-3 grid gap-2 md:grid-cols-4">
        <select v-model="optForm.kind" class="input-field">
          <option value="PHONE">گوشی</option>
          <option value="SIM">سیم</option>
        </select>
        <select v-model="optForm.category" class="input-field">
          <option value="brand">برند</option>
          <option value="storage">حافظه</option>
          <option value="color">رنگ</option>
          <option value="operator">اپراتور</option>
          <option value="type">نوع سیم</option>
          <option value="plan">پلن</option>
        </select>
        <input v-model="optForm.value" class="input-field" placeholder="مقدار" />
        <button class="btn-primary" type="button" @click="addOption">افزودن</button>
      </div>
      <div class="data-table-wrap">
        <table class="data-table min-w-[480px]">
          <thead>
            <tr>
              <th>نوع</th>
              <th>دسته</th>
              <th>مقدار</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in options" :key="o.id">
              <td>{{ o.kind }}</td>
              <td>{{ o.category }}</td>
              <td>{{ o.value }}</td>
              <td>
                <button v-if="auth.can('options.edit')" class="btn-ghost" type="button" @click="toggleOption(o)">
                  {{ o.isActive ? 'غیرفعال' : 'فعال' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="tab === 'report'" class="card p-4">
      <div v-if="!report" class="empty-state empty-state--plain"><p>بارگذاری…</p></div>
      <ul v-else class="space-y-2 text-sm">
        <li v-for="r in report.items" :key="r.id" class="flex justify-between">
          <span>{{ r.name }}</span>
          <span>{{ formatNumber(r.uniqueCustomers) }} مشتری یکتا</span>
        </li>
        <li class="flex justify-between border-t pt-2" style="border-color: var(--hr-border)">
          <span>بدون منبع</span>
          <span>{{ formatNumber(report.unassigned) }}</span>
        </li>
      </ul>
    </div>

    <div v-else class="grid gap-3">
      <div v-if="!edits.length" class="empty-state"><p class="empty-state__title">ویرایش حساس تأییدنشده نیست</p></div>
      <article v-for="e in edits" :key="e.id" class="card p-4">
        <p class="text-sm font-medium">{{ e.entityType }} · {{ e.editedBy?.username }}</p>
        <pre class="mt-2 whitespace-pre-wrap text-xs" style="color: var(--hr-muted)">{{ e.diffText }}</pre>
        <button class="btn-primary mt-2" type="button" @click="ack(e.id)">تأیید مشاهده</button>
      </article>
    </div>
  </div>
</template>
