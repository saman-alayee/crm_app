<script setup lang="ts">
const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const { formatNumber } = useFormat();

const loading = ref(true);
const items = ref<any[]>([]);
const sources = ref<any[]>([]);
const q = ref('');
const showForm = ref(false);
const form = reactive({ fullName: '', mobile: '', acquisitionSourceId: '', notes: '' });
const dirty = ref(false);
useDirtyForm(dirty);

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ limit: '50' });
    if (q.value.trim()) params.set('q', q.value.trim());
    const [list, src] = await Promise.all([
      api<{ success: boolean; data: { items: any[] } }>(`/contacts?${params}`),
      api<{ success: boolean; data: any[] }>('/sources'),
    ]);
    items.value = list.data.items;
    sources.value = (src.data || []).filter((s: any) => s.isActive);
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

async function create() {
  try {
    await api('/contacts', {
      method: 'POST',
      body: {
        ...form,
        fullName: form.fullName.trim(),
        mobile: form.mobile.trim(),
        acquisitionSourceId: form.acquisitionSourceId || null,
      },
    });
    toast.success('ثبت شد');
    dirty.value = false;
    showForm.value = false;
    Object.assign(form, { fullName: '', mobile: '', acquisitionSourceId: '', notes: '' });
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

onMounted(load);
useHead({ title: 'مشتریان' });
</script>

<template>
  <div>
    <AppPageNav />
    <UiPageHeader eyebrow="فروشگاه" title="مشتریان" subtitle="نام، موبایل و منبع جذب">
      <template #actions>
        <button v-if="auth.can('contacts.create')" class="btn-primary" type="button" @click="showForm = !showForm">
          مشتری جدید
        </button>
      </template>
    </UiPageHeader>

    <UiCard class="mb-4" padding="md">
      <div class="search-field">
        <AppIcon name="lucide:search" size="sm" class="search-field__icon" />
        <input v-model="q" class="input-field" placeholder="جست‌وجو نام یا موبایل…" @keyup.enter="load" />
      </div>
      <button class="btn-soft mt-2" type="button" @click="load">جست‌وجو</button>
    </UiCard>

    <div v-if="showForm" class="card mb-6 p-4">
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">نام</label>
          <input v-model="form.fullName" class="input-field" @input="dirty = true" />
        </div>
        <div>
          <label class="field-label">موبایل</label>
          <input v-model="form.mobile" class="input-field" dir="ltr" placeholder="09xxxxxxxxx" @input="dirty = true" />
        </div>
        <div>
          <label class="field-label">منبع جذب</label>
          <select v-model="form.acquisitionSourceId" class="input-field" @change="dirty = true">
            <option value="">—</option>
            <option v-for="s in sources" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label class="field-label">یادداشت</label>
          <input v-model="form.notes" class="input-field" @input="dirty = true" />
        </div>
      </div>
      <button class="btn-primary mt-4" type="button" @click="create">ذخیره</button>
    </div>

    <div v-if="loading" class="empty-state empty-state--plain"><p>در حال بارگذاری…</p></div>
    <div v-else-if="!items.length" class="empty-state">
      <p class="empty-state__title">مشتری‌ای نیست</p>
    </div>
    <div v-else class="data-table-wrap">
      <table class="data-table min-w-[560px]">
        <thead>
          <tr>
            <th>نام</th>
            <th>موبایل</th>
            <th>منبع</th>
            <th>یادداشت</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id">
            <td class="font-medium">{{ row.fullName }}</td>
            <td class="cell-mono" dir="ltr">{{ row.mobile }}</td>
            <td>{{ row.acquisitionSource?.name || '—' }}</td>
            <td class="cell-muted">{{ row.notes || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p class="p-3 text-xs" style="color: var(--hr-muted)">{{ formatNumber(items.length) }} مورد</p>
    </div>
  </div>
</template>
