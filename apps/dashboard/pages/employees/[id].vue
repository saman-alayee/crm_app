<script setup lang="ts">
const route = useRoute();
const { api } = useApi();
const toast = useToast();
const auth = useAuthStore();
const { formatDate } = useFormat();
const loading = ref(true);
const employee = ref<any>(null);
const roles = ref<any[]>([]);
const selectedRoleIds = ref<string[]>([]);
const notes = ref<any[]>([]);
const noteBody = ref('');
const noteSaving = ref(false);

async function load() {
  loading.value = true;
  try {
    const [emp, roleRes, notesRes] = await Promise.all([
      api<{ success: boolean; data: any }>(`/employees/${route.params.id}`),
      auth.can('roles.view')
        ? api<{ success: boolean; data: any[] }>('/roles')
        : Promise.resolve({ success: true, data: [] as any[] }),
      api<{ success: boolean; data: any[] }>(`/employees/${route.params.id}/notes`),
    ]);
    employee.value = emp.data;
    roles.value = roleRes.data || [];
    selectedRoleIds.value = (emp.data.user?.userRoles || []).map((ur: any) => ur.role.id);
    notes.value = notesRes.data || emp.data.notes || [];
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

async function saveRoles() {
  try {
    await api(`/roles/users/${employee.value.user.id}`, {
      method: 'PUT',
      body: { roleIds: selectedRoleIds.value },
    });
    toast.success('نقش‌ها ذخیره شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'ذخیره ناموفق');
  }
}

async function addNote() {
  if (!noteBody.value.trim()) return;
  noteSaving.value = true;
  try {
    await api(`/employees/${route.params.id}/notes`, {
      method: 'POST',
      body: { body: noteBody.value.trim() },
    });
    noteBody.value = '';
    toast.success('یادداشت ثبت شد');
    const notesRes = await api<{ success: boolean; data: any[] }>(`/employees/${route.params.id}/notes`);
    notes.value = notesRes.data;
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا در ثبت یادداشت');
  } finally {
    noteSaving.value = false;
  }
}

function authorName(n: any) {
  const e = n.author?.employee;
  if (e) return `${e.firstName} ${e.lastName}`;
  return n.author?.username || '—';
}

onMounted(load);
useHead({ title: 'جزئیات کارمند' });
</script>

<template>
  <div>
    <NuxtLink to="/employees" class="mb-4 inline-flex items-center gap-1 text-sm text-primary-700">
      <AppIcon name="lucide:arrow-right" size="sm" /> بازگشت به لیست کارکنان
    </NuxtLink>
    <LoadingSpinner v-if="loading" />
    <template v-else-if="employee">
      <UiHelpBanner
        storage-key="employee-detail"
        title="پرونده کارمند"
        :steps="[
          'اطلاعات اصلی، نقش‌ها و یادداشت‌های داخلی را اینجا مدیریت کنید.',
          'نقش‌ها تعیین می‌کنند این نفر به کدام منوها دسترسی دارد.',
          'یادداشت‌ها فقط برای مدیران است و کارمند آن‌ها را نمی‌بیند.',
        ]"
      />
      <div class="card mb-4 p-5">
        <h1 class="text-xl font-bold">{{ employee.firstName }} {{ employee.lastName }}</h1>
        <p class="mt-1 text-sm" style="color: var(--hr-muted)">
          @{{ employee.user?.username }} · {{ employee.jobTitle || 'بدون سمت' }}
        </p>
        <div class="mt-4 grid gap-2 text-sm md:grid-cols-2">
          <p>دپارتمان: {{ employee.department || '—' }}</p>
          <p>کد پرسنلی: {{ employee.employeeCode || '—' }}</p>
          <p>موبایل: {{ employee.phone || '—' }}</p>
          <p>تلگرام ID: {{ employee.telegramUserId || '—' }}</p>
          <p>تاریخ استخدام: {{ employee.hireDate ? formatDate(employee.hireDate) : '—' }}</p>
          <p>
            وضعیت:
            <span :class="employee.user?.isActive ? 'badge badge-approved' : 'badge badge-rejected'">
              {{ employee.user?.isActive ? 'فعال' : 'غیرفعال' }}
            </span>
          </p>
        </div>
      </div>

      <div v-if="auth.can('roles.manage_permissions')" class="card mb-4 p-5">
        <h2 class="mb-3 font-semibold">نقش‌های کاربر</h2>
        <p class="mb-3 text-xs" style="color: var(--hr-muted)">
          فقط نقش‌های مجاز برای شما قابل واگذاری است. پس از ذخیره، نشست کاربر باطل می‌شود.
        </p>
        <div class="flex flex-wrap gap-3">
          <label
            v-for="role in roles.filter((r) => auth.isOwner || (r.slug !== 'owner' && r.slug !== 'admin'))"
            :key="role.id"
            class="flex items-center gap-2 text-sm"
          >
            <input v-model="selectedRoleIds" type="checkbox" :value="role.id" />
            {{ role.name }}
          </label>
        </div>
        <button class="btn-primary mt-4" type="button" @click="saveRoles">ذخیره نقش‌ها</button>
      </div>

      <div class="card mb-4 p-5">
        <h2 class="mb-1 font-semibold">یادداشت‌های داخلی CRM</h2>
        <p class="mb-3 text-xs" style="color: var(--hr-muted)">فقط برای مدیران — قابل مشاهده در پرونده کارمند</p>
        <div v-if="auth.can('employees.edit')" class="mb-4 flex gap-2">
          <textarea
            v-model="noteBody"
            class="input-field min-h-[4.5rem] flex-1"
            placeholder="مثلاً: پیگیری قرارداد، عملکرد فصلی، هشدار انضباطی..."
          />
          <button class="btn-primary self-end" type="button" :disabled="noteSaving" @click="addNote">ثبت</button>
        </div>
        <EmptyState
          v-if="!notes.length"
          plain
          title="یادداشتی نیست"
          message="هنوز چیزی ثبت نشده"
          tip="نکات مهم عملکرد یا پیگیری را اینجا بنویسید."
          icon="lucide:sticky-note"
        />
        <ul v-else class="space-y-2">
          <li
            v-for="n in notes"
            :key="n.id"
            class="rounded-xl px-3 py-2 text-sm"
            style="background: var(--hr-primary-50)"
          >
            <p class="whitespace-pre-wrap">{{ n.body }}</p>
            <p class="mt-1 text-xs" style="color: var(--hr-muted)">
              {{ authorName(n) }} · {{ formatDate(n.createdAt) }}
            </p>
          </li>
        </ul>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <div class="card p-4">
          <h3 class="mb-2 font-semibold">مرخصی‌های اخیر</h3>
          <p v-for="l in employee.leaveRequests || []" :key="l.id" class="mb-1 text-sm" style="color: var(--hr-muted)">
            <StatusBadge :status="l.status" /> {{ l.type }}
          </p>
          <EmptyState v-if="!(employee.leaveRequests || []).length" plain message="مرخصی ثبت‌شده‌ای نیست" />
        </div>
        <div class="card p-4">
          <h3 class="mb-2 font-semibold">درخواست‌های مالی</h3>
          <p v-for="s in employee.salaryRequests || []" :key="s.id" class="mb-1 text-sm" style="color: var(--hr-muted)">
            <StatusBadge :status="s.status" /> <StatusBadge :status="s.type" />
          </p>
          <EmptyState v-if="!(employee.salaryRequests || []).length" plain message="درخواست مالی نیست" />
        </div>
        <div class="card p-4">
          <h3 class="mb-2 font-semibold">وظایف</h3>
          <p v-for="t in employee.assignedTasks || []" :key="t.id" class="mb-1 text-sm" style="color: var(--hr-muted)">
            <StatusBadge :status="t.status" /> {{ t.title }}
          </p>
          <EmptyState v-if="!(employee.assignedTasks || []).length" plain message="وظیفه‌ای نیست" />
        </div>
      </div>
    </template>
  </div>
</template>
