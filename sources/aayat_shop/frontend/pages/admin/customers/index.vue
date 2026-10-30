<script setup lang="ts">
import type { AdminCustomer, CustomerGroup } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();
const { formatPrice, formatNumber } = useFormat();

const customers = ref<AdminCustomer[]>([]);
const groups = ref<CustomerGroup[]>([]);
const loading = ref(true);
const search = ref('');
const groupFilter = ref('');
const selectedCustomer = ref<AdminCustomer | null>(null);
const detailLoading = ref(false);

const showCreate = ref(false);
const showGroupForm = ref(false);

const newCustomer = reactive({ phone: '', firstName: '', lastName: '', customerGroupId: '' });
const newGroup = reactive({ name: '', description: '' });

const groupOptions = computed(() => [
  { value: '', label: 'همه گروه‌ها', icon: 'lucide:users' },
  ...groups.value.map((group) => ({
    value: group.id,
    label: group.name,
    icon: 'lucide:tags',
  })),
]);

onMounted(loadData);

function queryParams() {
  const params = new URLSearchParams();
  if (search.value.trim()) params.set('search', search.value.trim());
  if (groupFilter.value) params.set('customerGroupId', groupFilter.value);
  params.set('limit', '100');
  return params;
}

async function loadData() {
  loading.value = true;
  try {
    const [customersRes, groupsRes] = await Promise.all([
      api.get<{ customers: AdminCustomer[] }>(`/admin/customers?${queryParams()}`),
      api.get<CustomerGroup[]>('/admin/customer-groups').catch(() => ({ data: [] as CustomerGroup[] })),
    ]);
    customers.value = customersRes.data.customers;
    groups.value = groupsRes.data;
  } catch {
    customers.value = [];
  } finally {
    loading.value = false;
  }
}

async function openCustomer(customer: AdminCustomer) {
  detailLoading.value = true;
  selectedCustomer.value = customer;
  try {
    const { data } = await api.get<AdminCustomer>(`/admin/customers/${customer.id}`);
    selectedCustomer.value = data;
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در دریافت جزئیات');
  } finally {
    detailLoading.value = false;
  }
}

async function createCustomer() {
  try {
    await api.post('/admin/customers', {
      ...newCustomer,
      customerGroupId: newCustomer.customerGroupId || undefined,
    });
    toast.success('مشتری اضافه شد');
    showCreate.value = false;
    Object.assign(newCustomer, { phone: '', firstName: '', lastName: '', customerGroupId: '' });
    await loadData();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ایجاد مشتری');
  }
}

async function createGroup() {
  try {
    await api.post('/admin/customer-groups', { ...newGroup });
    toast.success('گروه ایجاد شد');
    showGroupForm.value = false;
    Object.assign(newGroup, { name: '', description: '' });
    await loadData();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ایجاد گروه');
  }
}

async function assignGroup(customerId: string, customerGroupId: string) {
  try {
    await api.put(`/admin/customers/${customerId}/group`, {
      customerGroupId: customerGroupId || null,
    });
    toast.success('گروه به‌روزرسانی شد');
    await loadData();
    if (selectedCustomer.value?.id === customerId) await openCustomer(selectedCustomer.value);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا');
  }
}

function exportCsv() {
  const url = `/admin/customers/export-phones?${queryParams()}`;
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  fetch(`${config.public.apiBase}${url}`, {
    headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
  })
    .then((res) => res.blob())
    .then((blob) => {
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `customer-phones-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(href);
    })
    .catch(() => toast.error('خروجی اکسل ناموفق بود'));
}

function closeDetail() {
  selectedCustomer.value = null;
}

function customerName(customer: AdminCustomer) {
  return `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || '—';
}

useHead({ title: 'مشتریان - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
      <div>
        <h1 class="text-xl font-bold text-gray-800">مشتریان</h1>
        <p class="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
          خریداران ثبت‌نام‌شده این‌جا هستند. برای دیدن سفارش‌های هر نفر «جزئیات» را بزنید. مشتری جدید از خودِ سایت با شماره موبایل ساخته می‌شود.
        </p>
        <p class="text-sm text-gray-500 mt-1">لیست خریداران، گروه و خروجی شماره</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn-secondary text-sm" @click="exportCsv">خروجی شماره تماس</button>
      </div>
    </div>

    <div class="mb-4">
      <input
        v-model="search"
        type="search"
        placeholder="جستجو نام یا موبایل..."
        class="input-field md:max-w-sm"
        @keyup.enter="loadData"
      />
    </div>

    <button class="btn-primary text-sm mb-4" @click="loadData">اعمال فیلتر</button>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="data-table-wrap">
      <table class="data-table min-w-[760px]">
        <thead>
          <tr>
            <th>مشتری</th>
            <th>شماره تلفن</th>
            <th>آدرس</th>
            <th class="data-num">سفارش</th>
            <th class="data-num">جمع خرید</th>
            <th class="data-actions">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="customer in customers" :key="customer.id">
            <td class="font-semibold text-slate-800">{{ customerName(customer) }}</td>
            <td>
              <span dir="ltr" class="inline-block text-slate-600 tabular-nums">{{ customer.phone }}</span>
            </td>
            <td class="text-slate-500 max-w-[220px] truncate">{{ customer.address || '—' }}</td>
            <td class="data-num">{{ formatNumber(customer._count.orders) }}</td>
            <td class="data-num font-medium">{{ formatPrice(customer.totalSpend || 0) }}</td>
            <td class="data-actions">
              <div class="admin-actions">
                <button type="button" class="admin-btn-secondary" @click="openCustomer(customer)">جزئیات</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <EmptyState v-if="!loading && !customers.length" message="مشتری یافت نشد" />

    <div v-if="selectedCustomer" class="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4" @click.self="closeDetail">
      <div class="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 class="text-lg font-bold text-gray-800">{{ customerName(selectedCustomer) }}</h2>
            <p class="text-sm text-gray-500 mt-1" dir="ltr">{{ selectedCustomer.phone }}</p>
          </div>
          <button class="p-2 rounded-lg hover:bg-gray-100" @click="closeDetail">
            <AppIcon name="lucide:x" size="md" />
          </button>
        </div>

        <LoadingSpinner :show="detailLoading" />

        <div v-if="!detailLoading" class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div class="card p-3">
              <p class="text-xs text-gray-500">تعداد سفارش</p>
              <p class="text-xl font-bold">{{ formatNumber(selectedCustomer._count.orders) }}</p>
            </div>
            <div class="card p-3">
              <p class="text-xs text-gray-500">جمع خرید</p>
              <p class="text-sm font-bold">{{ formatPrice(selectedCustomer.totalSpend || 0) }}</p>
            </div>
          </div>

          <div v-if="selectedCustomer.addresses?.length">
            <h3 class="text-sm font-bold text-gray-700 mb-2">آدرس‌ها</h3>
            <p v-for="addr in selectedCustomer.addresses" :key="addr.id" class="text-sm text-gray-600 mb-1">
              {{ addr.address }}
            </p>
          </div>

          <div>
            <h3 class="text-sm font-bold text-gray-700 mb-2">تاریخچه سفارش</h3>
            <div v-if="selectedCustomer.orders?.length" class="space-y-2">
              <div
                v-for="order in selectedCustomer.orders"
                :key="order.id"
                class="rounded-xl border border-gray-100 p-3"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-medium" dir="ltr">{{ order.orderNumber }}</span>
                  <OrderStatusBadge :status="order.status" />
                </div>
                <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
                  <span>{{ formatPrice(order.totalPrice) }}</span>
                  <span>{{ new Date(order.createdAt).toLocaleDateString('fa-IR') }}</span>
                </div>
                <p v-if="order.deliveryAddress" class="text-xs text-gray-400 mt-1">{{ order.deliveryAddress }}</p>
              </div>
            </div>
            <EmptyState v-else message="سفارشی ثبت نشده" />
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
