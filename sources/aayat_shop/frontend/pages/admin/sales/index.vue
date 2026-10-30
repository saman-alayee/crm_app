<script setup lang="ts">

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const { formatPrice, formatNumber, formatShortDate, formatMonthYear } = useFormat();

const days = ref(30);
const dateFrom = ref<string | null>(null);
const dateTo = ref<string | null>(null);
const productSearch = ref('');
const loading = ref(true);
const overview = ref<{
  totalRevenue: number;
  orderCount: number;
  avgOrder: number;
  avgPerCustomer: number;
  uniqueCustomers: number;
  daily: { date: string; revenue: number; orders: number }[];
  workingDays: { date: string; revenue: number; orders: number }[];
  topProducts: { name: string; totalQuantity: number; product?: { barcode?: string | null } | null }[];
  monthly: {
    monthly: { month: string; revenue: number; orders: number }[];
    changePercent: number | null;
  };
} | null>(null);

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (dateFrom.value || dateTo.value) {
      if (dateFrom.value) params.set('dateFrom', dateFrom.value);
      if (dateTo.value) params.set('dateTo', dateTo.value);
    } else {
      params.set('days', String(days.value));
    }
    if (productSearch.value.trim()) params.set('productSearch', productSearch.value.trim());
    const { data } = await api.get<typeof overview.value>(`/admin/sales/overview?${params}`);
    overview.value = data;
  } finally {
    loading.value = false;
  }
}

function applyPreset() {
  dateFrom.value = null;
  dateTo.value = null;
  void load();
}

onMounted(load);
watch(days, applyPreset);

const maxDaily = computed(() => {
  const rows = overview.value?.workingDays?.length
    ? overview.value.workingDays
    : overview.value?.daily || [];
  return Math.max(...rows.map((d) => d.revenue), 1);
});
const maxMonthly = computed(() =>
  Math.max(...(overview.value?.monthly?.monthly.map((m) => m.revenue) || [1]), 1)
);

useHead({ title: 'گزارش فروش - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-xl font-bold">گزارش فروش</h1>
        <p class="text-sm leading-6 text-gray-500 mt-1 max-w-2xl">درآمد و پرفروش‌ترین لباس‌ها را در بازهٔ تاریخ ببینید. اگر نام لباس را بنویسید، گزارش همان کالا فیلتر می‌شود.</p>
      </div>
    </div>

    <div class="card p-4 mb-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <select v-model.number="days" class="input-field">
        <option :value="7">۷ روز اخیر</option>
        <option :value="30">۳۰ روز اخیر</option>
        <option :value="90">۹۰ روز اخیر</option>
      </select>
      <AppDatePicker v-model="dateFrom" placeholder="از تاریخ" />
      <AppDatePicker v-model="dateTo" placeholder="تا تاریخ" :min="dateFrom" />
      <input
        v-model="productSearch"
        type="search"
        class="input-field"
        placeholder="نام لباس"
        @keyup.enter="load"
      />
      <button class="btn-primary text-sm" @click="load">اعمال فیلتر</button>
    </div>

    <LoadingSpinner :show="loading" />

    <template v-if="!loading && overview">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div class="card p-4">
          <p class="text-xs text-gray-500">درآمد کل</p>
          <p class="text-lg font-bold mt-1">{{ formatPrice(overview.totalRevenue) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-gray-500">تعداد سفارش</p>
          <p class="text-lg font-bold mt-1">{{ formatNumber(overview.orderCount) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-gray-500">میانگین سفارش</p>
          <p class="text-lg font-bold mt-1">{{ formatPrice(overview.avgOrder) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-gray-500">میانگین هر مشتری</p>
          <p class="text-lg font-bold mt-1">{{ formatPrice(overview.avgPerCustomer || 0) }}</p>
        </div>
      </div>

      <div class="mb-6">
        <div class="card p-4">
          <h2 class="font-semibold mb-4">فروش روزهای کاری (به‌جز جمعه)</h2>
          <div class="space-y-2 max-h-72 overflow-y-auto">
            <div v-for="day in (overview.workingDays || overview.daily).slice().reverse()" :key="day.date" class="flex items-center gap-3">
              <span class="text-xs text-gray-500 w-24 shrink-0">{{ formatShortDate(day.date) }}</span>
              <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary-500 rounded-full"
                  :style="{ width: `${Math.round((day.revenue / maxDaily) * 100)}%` }"
                />
              </div>
              <span class="text-xs font-medium w-24 text-end">{{ formatPrice(day.revenue) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="overview.monthly?.monthly?.length" class="card p-4 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold">فروش ماهانه</h2>
          <span v-if="overview.monthly.changePercent != null" class="text-sm text-gray-500">
            نسبت به ماه قبل:
            <b :class="overview.monthly.changePercent >= 0 ? 'text-green-600' : 'text-red-500'">
              {{ overview.monthly.changePercent }}٪
            </b>
          </span>
        </div>
        <div class="space-y-2">
          <div v-for="row in overview.monthly.monthly" :key="row.month" class="flex items-center gap-3">
            <span class="text-xs text-gray-500 w-24 shrink-0">{{ formatMonthYear(`${row.month}-01`) }}</span>
            <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                class="h-full bg-accent-500 rounded-full"
                :style="{ width: `${Math.round((row.revenue / maxMonthly) * 100)}%` }"
              />
            </div>
            <span class="text-xs font-medium w-28 text-end">{{ formatPrice(row.revenue) }}</span>
          </div>
        </div>
      </div>

      <div class="data-table-wrap p-0">
        <div class="px-4 pt-4 pb-2">
          <h2 class="font-semibold text-slate-800">پرفروش‌ترین محصولات</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>لباس</th>
                <th class="data-num">تعداد فروش</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in overview.topProducts" :key="item.name">
                <td class="font-medium text-slate-800">{{ item.name }}</td>
                <td class="data-num font-semibold">{{ formatNumber(item.totalQuantity) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
