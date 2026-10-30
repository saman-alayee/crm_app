<script setup lang="ts">
const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const { formatNumber, formatShortDate } = useFormat();

const loading = ref(true);
const items = ref<any[]>([]);
const matches = ref<any[]>([]);
const sources = ref<any[]>([]);
const options = ref<any[]>([]);
const showForm = ref(false);
const tab = ref<'list' | 'matches'>('list');
const filter = reactive({ side: '', status: 'OPEN', productKind: '' });
const form = reactive({
  side: 'BUY' as 'BUY' | 'SELL',
  productKind: 'PHONE' as 'PHONE' | 'SIM',
  customerName: '',
  customerMobile: '',
  acquisitionSourceId: '',
  specs: {} as Record<string, any>,
  quantity: 1,
  price: '' as number | '',
  note: '',
});
const dirty = ref(false);
useDirtyForm(dirty);

const sideLabel: Record<string, string> = { BUY: 'خرید', SELL: 'فروش' };
const statusLabel: Record<string, string> = {
  OPEN: 'باز',
  MATCHED: 'تطبیق‌شده',
  CLOSED: 'بسته',
  CANCELLED: 'لغو',
};

async function load() {
  loading.value = true;
  try {
    const q = new URLSearchParams({ limit: '50' });
    if (filter.side) q.set('side', filter.side);
    if (filter.status) q.set('status', filter.status);
    if (filter.productKind) q.set('productKind', filter.productKind);
    const [list, matchRes, src, opt] = await Promise.all([
      api<{ success: boolean; data: { items: any[] } }>(`/trades?${q}`),
      api<{ success: boolean; data: any[] }>('/trades/matches'),
      api<{ success: boolean; data: any[] }>('/sources'),
      api<{ success: boolean; data: any[] }>('/options?active=1'),
    ]);
    items.value = list.data.items;
    matches.value = matchRes.data;
    sources.value = (src.data || []).filter((s: any) => s.isActive);
    options.value = opt.data || [];
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

function markDirty() {
  dirty.value = true;
}

async function create() {
  try {
    await api('/trades', {
      method: 'POST',
      body: {
        ...form,
        acquisitionSourceId: form.acquisitionSourceId || null,
        price: form.price === '' ? null : form.price,
        customerName: form.customerName.trim() || null,
        customerMobile: form.customerMobile.trim() || null,
      },
    });
    toast.success('ثبت شد');
    dirty.value = false;
    showForm.value = false;
    Object.assign(form, {
      customerName: '',
      customerMobile: '',
      acquisitionSourceId: '',
      specs: {},
      quantity: 1,
      price: '',
      note: '',
    });
    await load();
    tab.value = 'matches';
  } catch (e: any) {
    toast.error(e?.data?.message || 'ثبت ناموفق');
  }
}

async function setStatus(id: string, status: string) {
  try {
    await api(`/trades/${id}`, { method: 'PUT', body: { status } });
    toast.success('وضعیت به‌روز شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function dismissMatch(id: string) {
  try {
    await api(`/trades/matches/${id}/dismiss`, { method: 'POST' });
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

function specsText(row: any) {
  const s = row.specs || {};
  if (row.productKind === 'SIM') return [s.operator, s.type, s.plan].filter(Boolean).join(' / ');
  return [s.brand, s.model, s.storage, s.color].filter(Boolean).join(' / ');
}

onMounted(load);
useHead({ title: 'خرید و فروش' });
</script>

<template>
  <div>
    <AppPageNav />
    <UiPageHeader eyebrow="فروشگاه" title="خرید و فروش" subtitle="درخواست خرید/فروش، مشتری دستی و تطبیق خودکار">
      <template #actions>
        <button v-if="auth.can('trades.create')" class="btn-primary" type="button" @click="showForm = !showForm">
          درخواست جدید
        </button>
      </template>
    </UiPageHeader>

    <div class="mb-4 flex flex-wrap gap-2">
      <button type="button" class="filter-chip" :class="{ 'is-active': tab === 'list' }" @click="tab = 'list'">
        درخواست‌ها
      </button>
      <button type="button" class="filter-chip" :class="{ 'is-active': tab === 'matches' }" @click="tab = 'matches'">
        تطبیق‌ها
        <span v-if="matches.length" class="ms-1">({{ formatNumber(matches.length) }})</span>
      </button>
    </div>

    <div v-if="showForm" class="card mb-6 p-4">
      <h2 class="mb-3 font-semibold">ثبت درخواست</h2>
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">نوع</label>
          <select v-model="form.side" class="input-field" @change="markDirty">
            <option value="BUY">خرید</option>
            <option value="SELL">فروش</option>
          </select>
        </div>
        <div>
          <label class="field-label">کالا</label>
          <select v-model="form.productKind" class="input-field" @change="form.specs = {}; markDirty()">
            <option value="PHONE">گوشی</option>
            <option value="SIM">سیم‌کارت</option>
          </select>
        </div>
        <div>
          <label class="field-label">نام مشتری</label>
          <input v-model="form.customerName" class="input-field" placeholder="اختیاری / دستی" @input="markDirty" />
        </div>
        <div>
          <label class="field-label">موبایل مشتری</label>
          <input
            v-model="form.customerMobile"
            class="input-field"
            dir="ltr"
            placeholder="09xxxxxxxxx"
            @input="markDirty"
          />
        </div>
        <div>
          <label class="field-label">منبع جذب</label>
          <select v-model="form.acquisitionSourceId" class="input-field" @change="markDirty">
            <option value="">—</option>
            <option v-for="s in sources" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label class="field-label">تعداد</label>
          <input v-model.number="form.quantity" class="input-field" type="number" min="1" @input="markDirty" />
        </div>
        <div>
          <label class="field-label">قیمت پیشنهادی</label>
          <input v-model="form.price" class="input-field" type="number" dir="ltr" @input="markDirty" />
        </div>
        <div>
          <label class="field-label">توضیح</label>
          <input v-model="form.note" class="input-field" @input="markDirty" />
        </div>
      </div>
      <div class="mt-3">
        <p class="field-label mb-2">مشخصات {{ form.productKind === 'SIM' ? 'سیم' : 'گوشی' }}</p>
        <ProductSpecsFields v-model="form.specs" :product-kind="form.productKind" :options="options" @update:model-value="markDirty" />
      </div>
      <button class="btn-primary mt-4" type="button" @click="create">ثبت</button>
    </div>

    <template v-if="tab === 'list'">
      <div class="mb-3 flex flex-wrap gap-2">
        <select v-model="filter.side" class="input-field max-w-[140px]" @change="load">
          <option value="">همه طرف‌ها</option>
          <option value="BUY">خرید</option>
          <option value="SELL">فروش</option>
        </select>
        <select v-model="filter.status" class="input-field max-w-[140px]" @change="load">
          <option value="">همه وضعیت‌ها</option>
          <option value="OPEN">باز</option>
          <option value="MATCHED">تطبیق‌شده</option>
          <option value="CLOSED">بسته</option>
          <option value="CANCELLED">لغو</option>
        </select>
        <select v-model="filter.productKind" class="input-field max-w-[140px]" @change="load">
          <option value="">همه کالاها</option>
          <option value="PHONE">گوشی</option>
          <option value="SIM">سیم‌کارت</option>
        </select>
      </div>

      <div v-if="loading" class="empty-state empty-state--plain"><p>در حال بارگذاری…</p></div>
      <div v-else-if="!items.length" class="empty-state">
        <AppIcon name="lucide:shopping-bag" class="empty-state__icon" />
        <p class="empty-state__title">درخواستی نیست</p>
      </div>
      <div v-else class="grid gap-3">
        <article v-for="row in items" :key="row.id" class="card p-4">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p class="font-semibold">
                {{ sideLabel[row.side] }} · {{ row.productKind === 'SIM' ? 'سیم' : 'گوشی' }}
                <span class="ms-2 text-xs font-normal" style="color: var(--hr-muted)">{{ statusLabel[row.status] }}</span>
              </p>
              <p class="mt-1 text-sm">{{ specsText(row) }}</p>
              <p class="mt-1 text-xs" style="color: var(--hr-muted)">
                {{ row.customerName || row.contact?.fullName || 'بدون مشتری' }}
                <span v-if="row.customerMobile || row.contact?.mobile" dir="ltr">
                  · {{ row.customerMobile || row.contact?.mobile }}
                </span>
                · {{ formatShortDate(row.createdAt) }}
              </p>
            </div>
            <div v-if="auth.can('trades.edit')" class="flex flex-wrap gap-1">
              <button v-if="row.status === 'OPEN'" class="btn-soft" type="button" @click="setStatus(row.id, 'MATCHED')">
                تطبیق
              </button>
              <button v-if="row.status !== 'CLOSED'" class="btn-ghost" type="button" @click="setStatus(row.id, 'CLOSED')">
                بستن
              </button>
            </div>
          </div>
        </article>
      </div>
    </template>

    <template v-else>
      <div v-if="!matches.length" class="empty-state">
        <AppIcon name="lucide:git-compare" class="empty-state__icon" />
        <p class="empty-state__title">تطبیقی نیست</p>
      </div>
      <div v-else class="grid gap-3">
        <article v-for="m in matches" :key="m.id" class="card p-4">
          <p class="font-semibold">
            {{ m.kind === 'BUY_SELL' ? 'خرید ↔ فروش' : 'خرید ↔ موجودی' }}
            · {{ m.score === 'EXACT' ? 'دقیق' : 'مشابه' }}
          </p>
          <p class="mt-1 text-sm" style="color: var(--hr-muted)">
            <template v-if="m.buyRequest">خرید: {{ specsText(m.buyRequest) }}</template>
            <template v-if="m.sellRequest"> · فروش: {{ specsText(m.sellRequest) }}</template>
            <template v-if="m.inventoryItem"> · موجودی ×{{ formatNumber(m.inventoryItem.quantity) }}</template>
          </p>
          <button class="btn-ghost mt-2" type="button" @click="dismissMatch(m.id)">نادیده بگیر</button>
        </article>
      </div>
    </template>
  </div>
</template>
