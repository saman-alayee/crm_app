<script setup lang="ts">
import { ACTION_LABELS, MODULE_LABELS } from '~/utils/routePermissions';

const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();

const loading = ref(true);
const roles = ref<any[]>([]);
const permissions = ref<any[]>([]);
const selectedRoleId = ref<string | null>(null);
const selectedKeys = ref<string[]>([]);
const newName = ref('');
const newDesc = ref('');
const assignUserId = ref('');
const assignRoleIds = ref<string[]>([]);
const employees = ref<any[]>([]);

const selectedRole = computed(() => roles.value.find((r) => r.id === selectedRoleId.value) || null);
const isLockedFullAccess = computed(() => {
  const slug = selectedRole.value?.slug;
  return slug === 'owner' || slug === 'admin';
});

async function load() {
  loading.value = true;
  try {
    const [r, p] = await Promise.all([
      api<{ success: boolean; data: any[] }>('/roles'),
      api<{ success: boolean; data: any[] }>('/roles/permissions'),
    ]);
    roles.value = r.data;
    permissions.value = p.data;
    if (!selectedRoleId.value && roles.value[0]) selectRole(roles.value[0]);
    else if (selectedRoleId.value) {
      const current = roles.value.find((x) => x.id === selectedRoleId.value);
      if (current) selectRole(current);
    }
    if (auth.can('employees.view') && auth.can('roles.manage_permissions')) {
      const emp = await api<{ success: boolean; data: { items: any[] } }>('/employees?limit=100');
      employees.value = emp.data.items || [];
    }
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

function selectRole(role: any) {
  selectedRoleId.value = role.id;
  if (role.slug === 'owner' || role.slug === 'admin') {
    selectedKeys.value = permissions.value.map((p) => p.key);
  } else {
    selectedKeys.value = (role.rolePermissions || []).map((rp: any) => rp.permission.key);
  }
}

async function createRole() {
  try {
    const res = await api<{ success: boolean; data: any }>('/roles', {
      method: 'POST',
      body: { name: newName.value, description: newDesc.value, permissionKeys: selectedKeys.value },
    });
    toast.success('نقش ایجاد شد');
    newName.value = '';
    newDesc.value = '';
    await load();
    selectRole(res.data);
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function savePermissions() {
  if (!selectedRoleId.value) return;
  try {
    const res = await api<{ success: boolean; data: any }>(`/roles/${selectedRoleId.value}/permissions`, {
      method: 'PUT',
      body: { permissionKeys: selectedKeys.value },
    });
    toast.success('مجوزها ذخیره شد');
    await load();
    selectRole(res.data);
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function removeRole(id: string) {
  try {
    await api(`/roles/${id}`, { method: 'DELETE' });
    toast.success('حذف شد');
    selectedRoleId.value = null;
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'حذف ممکن نیست');
  }
}

function toggleModule(moduleName: string, on: boolean) {
  const keys = (grouped.value[moduleName] || []).map((p: any) => p.key);
  if (on) {
    selectedKeys.value = [...new Set([...selectedKeys.value, ...keys])];
  } else {
    const drop = new Set(keys);
    selectedKeys.value = selectedKeys.value.filter((k) => !drop.has(k));
  }
}

function moduleChecked(moduleName: string) {
  const keys = (grouped.value[moduleName] || []).map((p: any) => p.key);
  return keys.length > 0 && keys.every((k: string) => selectedKeys.value.includes(k));
}

function onPickUser() {
  const row = employees.value.find((e) => e.user?.id === assignUserId.value);
  assignRoleIds.value = (row?.user?.userRoles || []).map((ur: any) => ur.role?.id || ur.roleId).filter(Boolean);
  if (!assignRoleIds.value.length && row?.user?.userRoles) {
    assignRoleIds.value = row.user.userRoles.map((ur: any) => ur.role.id);
  }
}

async function saveUserRoles() {
  if (!assignUserId.value) return;
  try {
    await api(`/roles/users/${assignUserId.value}`, {
      method: 'PUT',
      body: { roleIds: assignRoleIds.value },
    });
    toast.success('نقش‌های کاربر ذخیره شد — نشست کاربر باطل می‌شود');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا در انتساب نقش');
  }
}

const grouped = computed(() => {
  const map: Record<string, any[]> = {};
  for (const p of permissions.value) {
    (map[p.module] ||= []).push(p);
  }
  return map;
});

const assignableRoles = computed(() => {
  if (auth.isOwner) return roles.value;
  return roles.value.filter((r) => r.slug !== 'owner' && r.slug !== 'admin');
});

onMounted(load);
useHead({ title: 'نقش‌ها و دسترسی‌ها' });
</script>

<template>
  <div>
    <UiPageHeader
      eyebrow="امنیت"
      title="نقش‌ها و دسترسی‌ها"
      subtitle="مشخص کنید هر نقش چه بخش‌هایی از پنل را ببیند"
    />

    <UiHelpBanner
      storage-key="roles"
      title="راهنمای دسترسی‌ها"
      :steps="[
        'از ستون راست یک نقش را انتخاب کنید.',
        'تیک مجوزهای لازم را بزنید و ذخیره کنید.',
        'نقش Owner/Admin همیشه دسترسی کامل دارد و قابل محدود کردن نیست.',
        'برای دادن نقش به نفر، پایین صفحه کاربر را انتخاب کنید یا از پرونده کارمند اقدام کنید.',
      ]"
    />

    <LoadingSpinner v-if="loading" />
    <div v-else class="grid gap-4 xl:grid-cols-[260px_1fr]">
      <aside class="card p-4">
        <h2 class="mb-3 text-sm font-semibold">نقش‌ها</h2>
        <button
          v-for="role in roles"
          :key="role.id"
          type="button"
          class="mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-start text-sm transition hover:bg-primary-50"
          :class="selectedRoleId === role.id ? 'bg-primary-50 text-primary-700' : ''"
          @click="selectRole(role)"
        >
          <span class="flex flex-col">
            <span class="font-medium">{{ role.name }}</span>
            <span class="text-[11px]" style="color: var(--hr-muted)">{{ role.slug }}</span>
          </span>
          <span class="text-xs" style="color: var(--hr-muted)">{{ role._count?.userRoles || 0 }}</span>
        </button>

        <div v-if="auth.can('roles.create')" class="mt-4 border-t pt-4" style="border-color: var(--hr-border)">
          <label class="field-label">نقش سفارشی</label>
          <input v-model="newName" class="input-field mb-2" placeholder="نام نقش" />
          <input v-model="newDesc" class="input-field mb-2" placeholder="توضیح" />
          <button class="btn-primary w-full" type="button" @click="createRole">ایجاد نقش</button>
        </div>
      </aside>

      <div class="space-y-4">
        <section class="card p-4">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold">{{ selectedRole?.name || 'انتخاب نقش' }}</h2>
              <p v-if="selectedRole?.description" class="mt-0.5 text-xs" style="color: var(--hr-muted)">
                {{ selectedRole.description }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-if="auth.can('roles.manage_permissions') && !isLockedFullAccess"
                class="btn-primary"
                type="button"
                @click="savePermissions"
              >
                ذخیره مجوزها
              </button>
              <button
                v-if="auth.can('roles.delete') && selectedRoleId && !selectedRole?.isSystem"
                class="btn-secondary text-red-600"
                type="button"
                @click="removeRole(selectedRoleId!)"
              >
                حذف نقش
              </button>
            </div>
          </div>

          <div
            v-if="isLockedFullAccess"
            class="mb-4 rounded-xl px-3 py-2 text-sm"
            style="background: var(--hr-primary-50); color: var(--hr-primary-800)"
          >
            این نقش دسترسی کامل به همه ماژول‌ها دارد و قابل کاهش نیست.
          </div>

          <div v-for="(list, moduleName) in grouped" :key="moduleName" class="mb-5">
            <div class="mb-2 flex items-center justify-between gap-2">
              <h3 class="text-sm font-semibold">{{ MODULE_LABELS[moduleName] || moduleName }}</h3>
              <label v-if="!isLockedFullAccess && auth.can('roles.manage_permissions')" class="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  :checked="moduleChecked(String(moduleName))"
                  @change="toggleModule(String(moduleName), ($event.target as HTMLInputElement).checked)"
                />
                همه
              </label>
            </div>
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label
                v-for="p in list"
                :key="p.key"
                class="flex items-start gap-2 rounded-xl border px-3 py-2 text-sm"
                style="border-color: var(--hr-border)"
              >
                <input
                  v-model="selectedKeys"
                  type="checkbox"
                  class="mt-0.5"
                  :value="p.key"
                  :disabled="isLockedFullAccess || !auth.can('roles.manage_permissions')"
                />
                <span>
                  <span class="font-medium">{{ ACTION_LABELS[p.action] || p.action }}</span>
                  <span class="mt-0.5 block text-[11px]" style="color: var(--hr-muted)">{{ p.description || p.key }}</span>
                </span>
              </label>
            </div>
          </div>
        </section>

        <section v-if="auth.can('roles.manage_permissions')" class="card p-4">
          <h2 class="mb-1 font-semibold">واگذاری نقش به کاربر</h2>
          <p class="mb-4 text-xs" style="color: var(--hr-muted)">
            بعد از ذخیره، نشست کاربر باطل می‌شود تا دسترسی‌های جدید اعمال شوند.
          </p>
          <div class="grid gap-3 md:grid-cols-2">
            <div>
              <label class="field-label">کاربر</label>
              <select v-model="assignUserId" class="input-field" @change="onPickUser">
                <option value="">— انتخاب —</option>
                <option v-for="e in employees" :key="e.id" :value="e.user?.id">
                  {{ e.firstName }} {{ e.lastName }} (@{{ e.user?.username }})
                </option>
              </select>
            </div>
            <div>
              <label class="field-label">نقش‌ها</label>
              <div class="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border p-2" style="border-color: var(--hr-border)">
                <label v-for="role in assignableRoles" :key="role.id" class="flex items-center gap-1.5 text-sm">
                  <input v-model="assignRoleIds" type="checkbox" :value="role.id" />
                  {{ role.name }}
                </label>
              </div>
            </div>
          </div>
          <button class="btn-primary mt-4" type="button" :disabled="!assignUserId" @click="saveUserRoles">
            ذخیره نقش کاربر
          </button>
        </section>
      </div>
    </div>
  </div>
</template>
