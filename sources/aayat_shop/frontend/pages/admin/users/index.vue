<script setup lang="ts">
import type { AccessRole, PanelPermission, User, UserRole, Pagination } from '~/types';
import { ROLE_LABELS, PERMISSION_LABELS, BUILTIN_ROLE_GUIDE } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();
const { formatNumber } = useFormat();

interface UserRow extends User {
  createdAt: string;
  _count: { orders: number };
}

const users = ref<UserRow[]>([]);
const customRoles = ref<AccessRole[]>([]);
const loading = ref(true);
const search = ref('');
const roleFilter = ref<'ALL' | UserRole>('ALL');
const showGuide = ref(true);

const roleOptions = [
  { value: 'ALL', label: 'همه نقش‌ها', icon: 'lucide:users' },
  { value: 'CUSTOMER', label: 'مشتری', icon: 'lucide:user' },
  { value: 'ADMIN', label: 'مدیر', icon: 'lucide:shield-check' },
  { value: 'SUPERVISOR', label: 'مسئول', icon: 'lucide:user-cog' },
  { value: 'STAFF', label: 'پرسنل', icon: 'lucide:hard-hat' },
];

const showAdminForm = ref(false);
const adminForm = reactive({
  phone: '',
  firstName: '',
  lastName: '',
  assignment: 'STAFF',
});
const formError = ref('');

const showRoleForm = ref(false);
const editingRoleId = ref<string | null>(null);
const roleForm = reactive({
  name: '',
  description: '',
  permissions: [] as PanelPermission[],
});
const roleFormError = ref('');

const assignablePermissions = (Object.keys(PERMISSION_LABELS) as PanelPermission[]).filter(
  (key) => key !== 'users' && key !== 'dashboard'
);

const assignmentOptions = computed(() => [
  { value: 'CUSTOMER', label: 'مشتری' },
  { value: 'STAFF', label: 'پرسنل (پیش‌فرض)' },
  { value: 'SUPERVISOR', label: 'مسئول (پیش‌فرض)' },
  { value: 'ADMIN', label: 'مدیر (پیش‌فرض)' },
  ...customRoles.value.map((role) => ({
    value: `custom:${role.id}`,
    label: `سفارشی: ${role.name}`,
  })),
]);

const roleBadgeClass: Record<UserRole, string> = {
  CUSTOMER: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
  ADMIN: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100',
  SUPERVISOR: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-100',
  STAFF: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100',
};

onMounted(async () => {
  await Promise.all([loadUsers(), loadCustomRoles()]);
});

function displayRole(user: UserRow) {
  if (user.accessRole?.name) return user.accessRole.name;
  return ROLE_LABELS[user.role];
}

function assignmentValue(user: UserRow) {
  if (user.accessRoleId) return `custom:${user.accessRoleId}`;
  return user.role;
}

async function loadUsers() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (search.value) params.set('search', search.value);
    if (roleFilter.value !== 'ALL') params.set('role', roleFilter.value);
    const { data } = await api.get<{ customers: UserRow[]; pagination: Pagination }>(
      `/admin/users?${params}`
    );
    users.value = data.customers;
  } finally {
    loading.value = false;
  }
}

async function loadCustomRoles() {
  try {
    const { data } = await api.get<{ roles: AccessRole[]; catalog: PanelPermission[] }>(
      '/admin/access-roles'
    );
    customRoles.value = data.roles.map((role) => ({
      ...role,
      permissions: (role.permissions || []) as PanelPermission[],
    }));
  } catch {
    customRoles.value = [];
  }
}

async function setAssignment(user: UserRow, value: string) {
  if (assignmentValue(user) === value) return;
  try {
    if (value.startsWith('custom:')) {
      const accessRoleId = value.slice('custom:'.length);
      await api.put(`/admin/users/${user.id}/role`, { role: 'STAFF', accessRoleId });
    } else {
      await api.put(`/admin/users/${user.id}/role`, {
        role: value as UserRole,
        accessRoleId: null,
      });
    }
    toast.success('نقش کاربر به‌روزرسانی شد');
    await loadUsers();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا');
  }
}

async function toggleActive(user: UserRow) {
  try {
    await api.put(`/admin/users/${user.id}/toggle-active`);
    toast.success('وضعیت کاربر به‌روزرسانی شد');
    await loadUsers();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا');
  }
}

async function createAdmin() {
  formError.value = '';
  try {
    const payload: Record<string, unknown> = {
      phone: adminForm.phone,
      firstName: adminForm.firstName || undefined,
      lastName: adminForm.lastName || undefined,
    };
    if (adminForm.assignment.startsWith('custom:')) {
      payload.accessRoleId = adminForm.assignment.slice('custom:'.length);
      payload.role = 'STAFF';
    } else {
      payload.role = adminForm.assignment;
      payload.accessRoleId = null;
    }
    await api.post('/admin/users/admin', payload);
    toast.success('کاربر پنل اضافه شد');
    showAdminForm.value = false;
    adminForm.phone = '';
    adminForm.firstName = '';
    adminForm.lastName = '';
    adminForm.assignment = 'STAFF';
    await loadUsers();
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'خطا';
    toast.error(formError.value);
  }
}

function openRoleForm(role?: AccessRole) {
  roleFormError.value = '';
  if (role) {
    editingRoleId.value = role.id;
    roleForm.name = role.name;
    roleForm.description = role.description || '';
    roleForm.permissions = [...role.permissions].filter((p) => p !== 'dashboard' && p !== 'users');
  } else {
    editingRoleId.value = null;
    roleForm.name = '';
    roleForm.description = '';
    roleForm.permissions = ['orders', 'products'];
  }
  showRoleForm.value = true;
}

function togglePermission(key: PanelPermission) {
  const idx = roleForm.permissions.indexOf(key);
  if (idx >= 0) roleForm.permissions.splice(idx, 1);
  else roleForm.permissions.push(key);
}

async function saveRole() {
  roleFormError.value = '';
  try {
    const payload = {
      name: roleForm.name,
      description: roleForm.description || null,
      permissions: ['dashboard', ...roleForm.permissions] as PanelPermission[],
    };
    if (editingRoleId.value) {
      await api.put(`/admin/access-roles/${editingRoleId.value}`, payload);
      toast.success('نقش به‌روزرسانی شد');
    } else {
      await api.post('/admin/access-roles', payload);
      toast.success('نقش ساخته شد');
    }
    showRoleForm.value = false;
    await loadCustomRoles();
  } catch (e: unknown) {
    roleFormError.value = e instanceof Error ? e.message : 'خطا';
    toast.error(roleFormError.value);
  }
}

async function deleteRole(role: AccessRole) {
  if (!confirm(`نقش «${role.name}» حذف شود؟`)) return;
  try {
    await api.delete(`/admin/access-roles/${role.id}`);
    toast.success('نقش حذف شد');
    await loadCustomRoles();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا');
  }
}

useHead({ title: 'کاربران - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
      <div>
        <h1 class="text-xl font-bold text-gray-800">مدیریت کاربران و نقش‌ها</h1>
        <p class="text-sm text-gray-500 mt-1">نقش‌های پیش‌فرض + نقش‌های سفارشی با دسترسی انتخابی</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn-secondary text-sm" @click="showGuide = !showGuide">
          {{ showGuide ? 'بستن راهنما' : 'راهنمای دسترسی' }}
        </button>
        <button class="btn-secondary text-sm" @click="openRoleForm()">+ نقش سفارشی</button>
        <button class="btn-primary text-sm" @click="showAdminForm = true">+ کاربر پنل</button>
      </div>
    </div>

    <div v-if="showGuide" class="grid md:grid-cols-3 gap-3 mb-6">
      <div
        v-for="guide in BUILTIN_ROLE_GUIDE"
        :key="guide.role"
        class="card p-4 border border-gray-100"
      >
        <h3 class="font-bold text-gray-800 mb-1">{{ guide.title }}</h3>
        <p class="text-xs text-gray-500 leading-relaxed mb-3">{{ guide.summary }}</p>
        <ul class="space-y-1">
          <li
            v-for="perm in guide.permissions"
            :key="perm"
            class="text-[11px] text-gray-600 flex items-center gap-1.5"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
            {{ PERMISSION_LABELS[perm] }}
          </li>
        </ul>
      </div>
    </div>

    <div v-if="customRoles.length" class="card p-4 mb-6">
      <h2 class="font-semibold text-gray-800 mb-3">نقش‌های سفارشی</h2>
      <div class="space-y-2">
        <div
          v-for="role in customRoles"
          :key="role.id"
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-gray-100 p-3"
        >
          <div class="min-w-0">
            <p class="font-medium text-gray-800">{{ role.name }}</p>
            <p v-if="role.description" class="text-xs text-gray-500 mt-0.5">{{ role.description }}</p>
            <p class="text-[11px] text-gray-400 mt-1">
              {{ role.permissions.map((p) => PERMISSION_LABELS[p] || p).join(' · ') }}
              <span v-if="role._count"> — {{ formatNumber(role._count.users) }} کاربر</span>
            </p>
          </div>
          <div class="flex gap-2 shrink-0">
            <button class="text-xs px-2 py-1 rounded bg-primary-50 text-primary-700" @click="openRoleForm(role)">
              ویرایش
            </button>
            <button class="text-xs px-2 py-1 rounded bg-red-50 text-red-600" @click="deleteRole(role)">
              حذف
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-col md:flex-row gap-3 mb-4">
      <input
        v-model="search"
        type="search"
        class="input-field md:max-w-xs"
        placeholder="جستجو نام یا موبایل..."
        @keyup.enter="loadUsers"
      />
      <AppSelect
        v-model="roleFilter"
        :options="roleOptions"
        class="md:max-w-[220px]"
        @change="loadUsers"
      />
      <button class="btn-secondary text-sm" @click="loadUsers">جستجو</button>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="data-table-wrap">
      <table class="data-table min-w-[800px]">
        <thead>
          <tr>
            <th>کاربر</th>
            <th>شماره تلفن</th>
            <th>نقش</th>
            <th class="data-num">سفارش</th>
            <th>وضعیت</th>
            <th class="data-actions">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td class="font-semibold text-slate-800">
              {{ `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—' }}
            </td>
            <td>
              <span dir="ltr" class="inline-block text-slate-600 tabular-nums">{{ user.phone }}</span>
            </td>
            <td>
              <span :class="roleBadgeClass[user.role]" class="admin-badge">
                {{ displayRole(user) }}
              </span>
            </td>
            <td class="data-num">{{ user._count.orders }}</td>
            <td>
              <span :class="user.isActive !== false ? 'admin-badge-success' : 'admin-badge-danger'">
                {{ user.isActive !== false ? 'فعال' : 'غیرفعال' }}
              </span>
            </td>
            <td class="data-actions">
              <div class="admin-actions">
                <select
                  class="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white max-w-[180px] font-medium text-slate-700"
                  :value="assignmentValue(user)"
                  @change="setAssignment(user, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="opt in assignmentOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
                <button
                  type="button"
                  :class="user.isActive !== false ? 'admin-btn-warn' : 'admin-btn-success'"
                  @click="toggleActive(user)"
                >
                  {{ user.isActive !== false ? 'غیرفعال' : 'فعال‌سازی' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showAdminForm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <form class="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" @submit.prevent="createAdmin">
        <h2 class="text-lg font-bold">افزودن کاربر پنل</h2>
        <AppAlertBanner :message="formError" />

        <div>
          <label class="block text-sm font-medium mb-1">موبایل</label>
          <input v-model="adminForm.phone" required class="input-field" dir="ltr" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1">نام</label>
            <input v-model="adminForm.firstName" class="input-field" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">نام خانوادگی</label>
            <input v-model="adminForm.lastName" class="input-field" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">سطح دسترسی</label>
          <select v-model="adminForm.assignment" class="input-field">
            <option v-for="opt in assignmentOptions.filter((o) => o.value !== 'CUSTOMER')" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="flex gap-2 justify-end">
          <button type="button" class="btn-secondary text-sm" @click="showAdminForm = false">انصراف</button>
          <button type="submit" class="btn-primary text-sm">ذخیره</button>
        </div>
      </form>
    </div>

    <div v-if="showRoleForm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <form class="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" @submit.prevent="saveRole">
        <h2 class="text-lg font-bold">{{ editingRoleId ? 'ویرایش نقش' : 'نقش سفارشی جدید' }}</h2>
        <AppAlertBanner :message="roleFormError" />
        <p class="text-xs text-gray-500 leading-relaxed">
          داشبورد همیشه فعال است. مدیریت کاربران فقط برای «مدیر» باقی می‌ماند و به نقش سفارشی داده نمی‌شود.
        </p>
        <div>
          <label class="block text-sm font-medium mb-1">نام نقش</label>
          <input v-model="roleForm.name" required class="input-field" placeholder="مثلاً انباردار" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">توضیح (اختیاری)</label>
          <input v-model="roleForm.description" class="input-field" placeholder="کار این نقش چیست؟" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">دسترسی به بخش‌ها</label>
          <div class="grid grid-cols-2 gap-2">
            <label
              v-for="key in assignablePermissions"
              :key="key"
              class="flex items-center gap-2 text-sm rounded-xl border border-gray-100 px-3 py-2 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                class="rounded border-gray-300"
                :checked="roleForm.permissions.includes(key)"
                @change="togglePermission(key)"
              />
              {{ PERMISSION_LABELS[key] }}
            </label>
          </div>
        </div>
        <div class="flex gap-2 justify-end">
          <button type="button" class="btn-secondary text-sm" @click="showRoleForm = false">انصراف</button>
          <button type="submit" class="btn-primary text-sm">ذخیره نقش</button>
        </div>
      </form>
    </div>
  </div>
</template>
