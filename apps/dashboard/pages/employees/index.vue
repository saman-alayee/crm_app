<script setup lang="ts">
const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const { formatNumber } = useFormat();

const loading = ref(true);
const items = ref<any[]>([]);
const departments = ref<{ id: string; name: string }[]>([]);
const roles = ref<{ id: string; name: string; slug: string }[]>([]);
const pagination = ref<any>(null);
const showForm = ref(false);

const filters = reactive({
  search: '',
  isActive: '' as '' | 'true' | 'false',
  department: '',
  jobTitle: '',
  roleId: '',
  hasTelegram: '' as '' | 'true' | 'false',
  sort: 'createdAt',
  order: 'desc' as 'asc' | 'desc',
});

const form = reactive({
  username: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  department: '',
  jobTitle: '',
  employeeCode: '',
});

const activeFilterCount = computed(() => {
  let n = 0;
  if (filters.search.trim()) n++;
  if (filters.isActive) n++;
  if (filters.department) n++;
  if (filters.jobTitle.trim()) n++;
  if (filters.roleId) n++;
  if (filters.hasTelegram) n++;
  return n;
});

async function load(page = 1) {
  loading.value = true;
  try {
    const q = new URLSearchParams({
      page: String(page),
      limit: '20',
      sort: filters.sort,
      order: filters.order,
    });
    if (filters.search.trim()) q.set('search', filters.search.trim());
    if (filters.isActive) q.set('isActive', filters.isActive);
    if (filters.department) q.set('department', filters.department);
    if (filters.jobTitle.trim()) q.set('jobTitle', filters.jobTitle.trim());
    if (filters.roleId) q.set('roleId', filters.roleId);
    if (filters.hasTelegram) q.set('hasTelegram', filters.hasTelegram);

    const res = await api<{ success: boolean; data: { items: any[]; pagination: any } }>(
      `/employees?${q}`,
      { cacheTtlMs: filters.search.trim() || activeFilterCount.value ? 0 : 6_000 }
    );
    items.value = res.data.items;
    pagination.value = res.data.pagination;
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا در دریافت کارکنان');
  } finally {
    loading.value = false;
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(1), 350);
}

function setStatus(value: '' | 'true' | 'false') {
  filters.isActive = value;
  void load(1);
}

function clearFilters() {
  filters.search = '';
  filters.isActive = '';
  filters.department = '';
  filters.jobTitle = '';
  filters.roleId = '';
  filters.hasTelegram = '';
  filters.sort = 'createdAt';
  filters.order = 'desc';
  void load(1);
}

function toggleSort(field: string) {
  if (filters.sort === field) {
    filters.order = filters.order === 'asc' ? 'desc' : 'asc';
  } else {
    filters.sort = field;
    filters.order = field === 'name' || field === 'department' ? 'asc' : 'desc';
  }
  void load(1);
}

async function createEmployee() {
  try {
    await api('/employees', { method: 'POST', body: { ...form } });
    toast.success('کارمند ایجاد شد');
    showForm.value = false;
    Object.assign(form, {
      username: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      department: '',
      jobTitle: '',
      employeeCode: '',
    });
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'ثبت ناموفق بود');
  }
}

async function toggleActive(row: any) {
  const active = row.user?.isActive;
  try {
    await api(`/employees/${row.id}/${active ? 'deactivate' : 'activate'}`, { method: 'POST' });
    toast.success(active ? 'حساب غیرفعال شد' : 'حساب فعال شد');
    await load(pagination.value?.page || 1);
  } catch (e: any) {
    toast.error(e?.data?.message || 'عملیات ناموفق');
  }
}

async function loadMeta() {
  try {
    const tasks: Promise<any>[] = [];
    if (auth.can('departments.view')) {
      tasks.push(
        api<{ success: boolean; data: { id: string; name: string }[] }>('/departments').then((res) => {
          departments.value = res.data || [];
        })
      );
    }
    if (auth.can('roles.view')) {
      tasks.push(
        api<{ success: boolean; data: any[] }>('/roles').then((res) => {
          roles.value = (res.data || []).map((r: any) => ({ id: r.id, name: r.name, slug: r.slug }));
        })
      );
    }
    await Promise.all(tasks);
  } catch {
    /* optional */
  }
}

onMounted(() => {
  void load();
  void loadMeta();
});
useHead({ title: 'کارکنان' });
</script>

<template>
  <div>
    <UiPageHeader
      eyebrow="فروشگاه سامی"
      title="کارکنان"
      subtitle="جست‌وجو کنید، فیلتر بزنید و پرونده هر نفر را باز کنید"
    >
      <template #actions>
        <button v-if="auth.can('employees.create')" class="btn-primary" type="button" @click="showForm = !showForm">
          <AppIcon name="lucide:user-plus" size="sm" />
          کارمند جدید
        </button>
      </template>
    </UiPageHeader>

    <UiHelpBanner
      storage-key="employees"
      title="راهنمای کارکنان"
      :steps="[
        'در کادر جست‌وجو نام، کد پرسنلی یا موبایل را تایپ کنید.',
        'با چیپ‌های «فعال / غیرفعال» و فیلتر دپارتمان لیست را کوتاه کنید.',
        'روی نام کارمند بزنید تا پرونده، نقش‌ها و یادداشت‌ها را ببینید.',
        'برای افزودن نفر جدید دکمه «کارمند جدید» را بزنید و نام کاربری + رمز بسازید.',
      ]"
    />

    <UiCard class="mb-4" padding="md">
      <div class="flex flex-wrap items-center gap-2">
        <div class="search-field min-w-[220px] flex-1">
          <AppIcon name="lucide:search" size="sm" class="search-field__icon" />
          <input
            v-model="filters.search"
            class="input-field"
            placeholder="نام، نام کامل، کد، موبایل، یوزرنیم، سمت…"
            @input="onSearchInput"
            @keyup.enter="load(1)"
          />
        </div>
        <button class="btn-soft" type="button" @click="load(1)">
          <AppIcon name="lucide:search" size="sm" />
          جست‌وجو
        </button>
        <button v-if="activeFilterCount" class="btn-ghost" type="button" @click="clearFilters">
          <AppIcon name="lucide:x" size="sm" />
          پاک کردن ({{ formatNumber(activeFilterCount) }})
        </button>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="filter-chip" :class="{ 'is-active': filters.isActive === '' }" @click="setStatus('')">
          همه
        </button>
        <button type="button" class="filter-chip" :class="{ 'is-active': filters.isActive === 'true' }" @click="setStatus('true')">
          فعال
        </button>
        <button type="button" class="filter-chip" :class="{ 'is-active': filters.isActive === 'false' }" @click="setStatus('false')">
          غیرفعال
        </button>
        <button
          type="button"
          class="filter-chip"
          :class="{ 'is-active': filters.hasTelegram === 'true' }"
          @click="filters.hasTelegram = filters.hasTelegram === 'true' ? '' : 'true'; load(1)"
        >
          <AppIcon name="lucide:send" size="sm" />
          تلگرام دارد
        </button>
        <button
          type="button"
          class="filter-chip"
          :class="{ 'is-active': filters.hasTelegram === 'false' }"
          @click="filters.hasTelegram = filters.hasTelegram === 'false' ? '' : 'false'; load(1)"
        >
          بدون تلگرام
        </button>
      </div>

      <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <select v-model="filters.department" class="input-field" @change="load(1)">
          <option value="">همه دپارتمان‌ها</option>
          <option v-for="d in departments" :key="d.id" :value="d.name">{{ d.name }}</option>
        </select>
        <select v-if="roles.length" v-model="filters.roleId" class="input-field" @change="load(1)">
          <option value="">همه نقش‌ها</option>
          <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
        <input
          v-model="filters.jobTitle"
          class="input-field"
          placeholder="فیلتر سمت"
          @keyup.enter="load(1)"
          @change="load(1)"
        />
        <select
          class="input-field"
          :value="`${filters.sort}:${filters.order}`"
          @change="
            (() => {
              const [s, o] = ($event.target as HTMLSelectElement).value.split(':');
              filters.sort = s;
              filters.order = o as 'asc' | 'desc';
              load(1);
            })()
          "
        >
          <option value="createdAt:desc">جدیدترین</option>
          <option value="createdAt:asc">قدیمی‌ترین</option>
          <option value="name:asc">نام (الف→ی)</option>
          <option value="name:desc">نام (ی→الف)</option>
          <option value="department:asc">دپارتمان</option>
          <option value="jobTitle:asc">سمت</option>
        </select>
      </div>
    </UiCard>

    <UiCard v-if="showForm" class="mb-4" padding="md">
      <h2 class="mb-1 font-semibold">ثبت کارمند</h2>
      <p class="mb-3 text-xs" style="color: var(--hr-muted)">
        نام کاربری و رمز برای ورود به پنل لازم است. بعداً می‌توانید نقش و دسترسی را از پرونده کارمند تنظیم کنید.
      </p>
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">نام</label>
          <input v-model="form.firstName" class="input-field" placeholder="مثال: سارا" />
        </div>
        <div>
          <label class="field-label">نام خانوادگی</label>
          <input v-model="form.lastName" class="input-field" placeholder="مثال: محمدی" />
        </div>
        <div>
          <label class="field-label">نام کاربری</label>
          <input v-model="form.username" class="input-field" placeholder="برای ورود به پنل" dir="ltr" />
          <UiFieldHint text="ترجیحاً انگلیسی و بدون فاصله — مثلاً sara.m" />
        </div>
        <div>
          <label class="field-label">رمز عبور</label>
          <input v-model="form.password" type="password" class="input-field" placeholder="حداقل ۶ کاراکتر" />
          <UiFieldHint text="این رمز را به کارمند بدهید تا بتواند وارد شود." />
        </div>
        <div>
          <label class="field-label">موبایل</label>
          <input v-model="form.phone" class="input-field" placeholder="09xxxxxxxxx" dir="ltr" />
        </div>
        <div>
          <label class="field-label">کد پرسنلی</label>
          <input v-model="form.employeeCode" class="input-field" placeholder="اختیاری" />
        </div>
        <div>
          <label class="field-label">دپارتمان</label>
          <select v-if="departments.length" v-model="form.department" class="input-field">
            <option value="">— انتخاب —</option>
            <option v-for="d in departments" :key="d.id" :value="d.name">{{ d.name }}</option>
          </select>
          <input v-else v-model="form.department" class="input-field" placeholder="نام واحد" />
          <UiFieldHint text="اگر دپارتمان ندارید، اول از منوی «دپارتمان‌ها» بسازید." />
        </div>
        <div>
          <label class="field-label">سمت</label>
          <input v-model="form.jobTitle" class="input-field" placeholder="مثال: فروشنده" />
        </div>
      </div>
      <button class="btn-primary mt-4" type="button" @click="createEmployee">ذخیره</button>
    </UiCard>

    <LoadingSpinner v-if="loading" />
    <EmptyState
      v-else-if="!items.length"
      title="کارمندی پیدا نشد"
      message="با این فیلترها نتیجه‌ای نیست"
      tip="فیلترها را پاک کنید یا با «کارمند جدید» اولین نفر را ثبت کنید."
      icon="lucide:users"
    >
      <button v-if="activeFilterCount" class="btn-soft" type="button" @click="clearFilters">پاک کردن فیلترها</button>
    </EmptyState>
    <div v-else class="data-table-wrap">
      <div class="overflow-x-auto">
        <table class="data-table min-w-[720px]">
          <thead>
            <tr>
              <th>
                <button type="button" class="btn-ghost !px-0 !py-0 text-xs" @click="toggleSort('name')">
                  نام
                  <AppIcon
                    v-if="filters.sort === 'name'"
                    :name="filters.order === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                    size="sm"
                  />
                </button>
              </th>
              <th>یوزرنیم</th>
              <th>
                <button type="button" class="btn-ghost !px-0 !py-0 text-xs" @click="toggleSort('department')">
                  دپارتمان
                </button>
              </th>
              <th>
                <button type="button" class="btn-ghost !px-0 !py-0 text-xs" @click="toggleSort('jobTitle')">
                  سمت
                </button>
              </th>
              <th>نقش</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in items" :key="row.id">
              <td>
                <NuxtLink :to="`/employees/${row.id}`" class="hover-underline font-medium text-primary-700">
                  {{ row.firstName }} {{ row.lastName }}
                </NuxtLink>
                <p v-if="row.employeeCode" class="mt-0.5 text-[11px]" style="color: var(--hr-muted)">
                  {{ row.employeeCode }}
                </p>
              </td>
              <td dir="ltr" class="text-xs">{{ row.user?.username }}</td>
              <td>{{ row.department || '—' }}</td>
              <td>{{ row.jobTitle || '—' }}</td>
              <td>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="ur in row.user?.userRoles || []"
                    :key="ur.role.id"
                    class="badge"
                    style="background: var(--hr-primary-50); color: var(--hr-primary-700)"
                  >
                    {{ ur.role.name }}
                  </span>
                  <span v-if="!(row.user?.userRoles || []).length" style="color: var(--hr-muted)">—</span>
                </div>
              </td>
              <td>
                <span :class="row.user?.isActive ? 'badge badge-approved' : 'badge badge-rejected'">
                  {{ row.user?.isActive ? 'فعال' : 'غیرفعال' }}
                </span>
              </td>
              <td>
                <div class="flex items-center gap-1">
                  <NuxtLink :to="`/employees/${row.id}`" class="btn-icon" title="جزئیات">
                    <AppIcon name="lucide:eye" size="sm" />
                  </NuxtLink>
                  <button
                    v-if="auth.can(row.user?.isActive ? 'employees.delete' : 'employees.edit')"
                    class="btn-icon"
                    :class="row.user?.isActive ? 'btn-icon--danger' : 'btn-icon--ok'"
                    type="button"
                    :title="row.user?.isActive ? 'قطع دسترسی' : 'فعال‌سازی'"
                    @click="toggleActive(row)"
                  >
                    <AppIcon :name="row.user?.isActive ? 'lucide:user-x' : 'lucide:user-check'" size="sm" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3" style="border-color: var(--hr-border)">
        <p class="text-xs" style="color: var(--hr-muted)">{{ formatNumber(pagination?.total || 0) }} نفر</p>
        <AppPagination :pagination="pagination" compact @update:page="load" />
      </div>
    </div>
  </div>
</template>
