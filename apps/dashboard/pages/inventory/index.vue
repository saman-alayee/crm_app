<script setup lang="ts">
const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const { formatNumber, formatShortDate } = useFormat();

const loading = ref(true);
const items = ref<any[]>([]);
const options = ref<any[]>([]);
const selected = ref<string[]>([]);
const showForm = ref(false);
const filterKind = ref('');
const form = reactive({
  productKind: 'PHONE' as 'PHONE' | 'SIM',
  specs: {} as Record<string, any>,
  quantity: 1,
  costPrice: '' as number | '',
  sellPrice: '' as number | '',
  note: '',
});
const dirty = ref(false);
useDirtyForm(dirty);

async function load() {
  loading.value = true;
  try {
    const q = new URLSearchParams({ limit: '50', inStock: '0' });
    if (filterKind.value) q.set('productKind', filterKind.value);
    const [list, opt] = await Promise.all([
      api<{ success: boolean; data: { items: any[] } }>(`/inventory?${q}`),
      api<{ success: boolean; data: any[] }>('/options?active=1'),
    ]);
    items.value = list.data.items;
    options.value = opt.data || [];
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

function specsText(row: any) {
  const s = row.specs || {};
  if (row.productKind === 'SIM') return [s.operator, s.type, s.plan].filter(Boolean).join(' / ');
  return [s.brand, s.model, s.storage, s.color].filter(Boolean).join(' / ');
}

function toggle(id: string) {
  if (selected.value.includes(id)) selected.value = selected.value.filter((x) => x !== id);
  else selected.value = [...selected.value, id];
}

function selectAll() {
  selected.value = items.value.filter((i) => i.quantity > 0).map((i) => i.id);
}

async function create() {
  try {
    await api('/inventory', {
      method: 'POST',
      body: {
        ...form,
        costPrice: form.costPrice === '' ? null : form.costPrice,
        sellPrice: form.sellPrice === '' ? null : form.sellPrice,
      },
    });
    toast.success('ثبت شد');
    dirty.value = false;
    showForm.value = false;
    form.specs = {};
    form.quantity = 1;
    form.costPrice = '';
    form.sellPrice = '';
    form.note = '';
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function createShare() {
  if (!selected.value.length) {
    toast.error('حداقل یک کالا را انتخاب کنید');
    return;
  }
  try {
    const res = await api<{ success: boolean; data: { token: string } }>('/shares', {
      method: 'POST',
      body: { inventoryItemIds: selected.value, title: 'لیست محصولات' },
    });
    const url = `${window.location.origin}/p/${res.data.token}`;
    await navigator.clipboard.writeText(url);
    toast.success('لینک ساخته و کپی شد');
    await navigateTo('/shares');
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

onMounted(load);
useHead({ title: 'موجودی' });
</script>

<template>
  <div>
    <AppPageNav />
    <UiPageHeader eyebrow="فروشگاه" title="موجودی" subtitle="گوشی و سیم — بدون نشت قیمت خرید در اشتراک">
      <template #actions>
        <button v-if="auth.can('inventory.create')" class="btn-primary" type="button" @click="showForm = !showForm">
          موجودی جدید
        </button>
      </template>
    </UiPageHeader>

    <div class="mb-3 flex flex-wrap gap-2">
      <select v-model="filterKind" class="input-field max-w-[160px]" @change="load">
        <option value="">همه</option>
        <option value="PHONE">گوشی</option>
        <option value="SIM">سیم‌کارت</option>
      </select>
      <button v-if="auth.can('shares.create')" class="btn-soft" type="button" @click="selectAll">انتخاب همه موجود</button>
      <button
        v-if="auth.can('shares.create')"
        class="btn-primary"
        type="button"
        :disabled="!selected.length"
        @click="createShare"
      >
        ساخت لینک اشتراک ({{ formatNumber(selected.length) }})
      </button>
    </div>

    <div v-if="showForm" class="card mb-6 p-4">
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">نوع</label>
          <select v-model="form.productKind" class="input-field" @change="form.specs = {}; dirty = true">
            <option value="PHONE">گوشی</option>
            <option value="SIM">سیم‌کارت</option>
          </select>
        </div>
        <div>
          <label class="field-label">تعداد</label>
          <input v-model.number="form.quantity" class="input-field" type="number" min="0" @input="dirty = true" />
        </div>
        <div v-if="auth.can('inventory.view_sensitive')">
          <label class="field-label">قیمت خرید</label>
          <input v-model="form.costPrice" class="input-field" type="number" dir="ltr" @input="dirty = true" />
        </div>
        <div>
          <label class="field-label">قیمت فروش</label>
          <input v-model="form.sellPrice" class="input-field" type="number" dir="ltr" @input="dirty = true" />
        </div>
      </div>
      <div class="mt-3">
        <ProductSpecsFields v-model="form.specs" :product-kind="form.productKind" :options="options" @update:model-value="dirty = true" />
      </div>
      <button class="btn-primary mt-4" type="button" @click="create">ذخیره</button>
    </div>

    <div v-if="loading" class="empty-state empty-state--plain"><p>در حال بارگذاری…</p></div>
    <div v-else-if="!items.length" class="empty-state"><p class="empty-state__title">موجودی خالی است</p></div>
    <div v-else class="grid gap-3">
      <article v-for="row in items" :key="row.id" class="card p-4">
        <div class="flex items-start gap-3">
          <input
            v-if="auth.can('shares.create')"
            type="checkbox"
            class="mt-1"
            :checked="selected.includes(row.id)"
            :disabled="row.quantity <= 0"
            @change="toggle(row.id)"
          />
          <div class="flex-1">
            <p class="font-semibold">
              {{ row.productKind === 'SIM' ? 'سیم' : 'گوشی' }} · {{ specsText(row) }}
            </p>
            <p class="mt-1 text-sm" style="color: var(--hr-muted)">
              تعداد: {{ formatNumber(row.quantity) }}
              <span v-if="row.sellPrice"> · فروش: {{ formatNumber(Number(row.sellPrice)) }}</span>
              <span v-if="auth.can('inventory.view_sensitive') && row.costPrice">
                · خرید: {{ formatNumber(Number(row.costPrice)) }}
              </span>
              · {{ formatShortDate(row.updatedAt) }}
            </p>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
