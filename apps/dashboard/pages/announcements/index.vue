<script setup lang="ts">
import { rules } from '~/composables/useFormValidation';

const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const { formatDate } = useFormat();
const { errors, clearField, validate } = useFormValidation();

const items = ref<any[]>([]);
const roles = ref<any[]>([]);
const loading = ref(true);
const showForm = ref(false);
const broadcastMode = ref(false);
const form = reactive({
  title: '',
  body: '',
  audience: 'ACTIVE_EMPLOYEES' as 'ALL' | 'ROLE' | 'ACTIVE_EMPLOYEES',
  roleId: '',
  isPinned: false,
  sendNotification: true,
});

async function load() {
  loading.value = true;
  try {
    const [a, r] = await Promise.all([
      api<{ success: boolean; data: any[] }>('/announcements'),
      auth.can('roles.view')
        ? api<{ success: boolean; data: any[] }>('/roles')
        : Promise.resolve({ data: [] as any[] }),
    ]);
    items.value = a.data;
    roles.value = r.data || [];
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

async function submit() {
  const schema: Record<string, ReturnType<typeof rules.required>[]> = {
    title: [rules.required('عنوان الزامی است'), rules.minLength(2), rules.maxLength(120)],
    body: [rules.required('متن پیام الزامی است'), rules.minLength(3)],
  };
  if (form.audience === 'ROLE') {
    schema.roleId = [rules.required('نقش مخاطب را انتخاب کنید')];
  }
  if (!validate({ ...form }, schema)) {
    toast.error('لطفاً خطاهای فرم را برطرف کنید');
    return;
  }
  try {
    if (broadcastMode.value) {
      const res = await api<{ success: boolean; data: { recipients: number }; message?: string }>(
        '/announcements/broadcast',
        {
          method: 'POST',
          body: {
            title: form.title,
            body: form.body,
            audience: form.audience,
            roleId: form.roleId || undefined,
          },
        }
      );
      toast.success(`اعلان برای ${res.data.recipients} نفر ارسال شد`);
    } else {
      await api('/announcements', {
        method: 'POST',
        body: { ...form, roleId: form.roleId || undefined },
      });
      toast.success('اطلاعیه ثبت و اعلان ارسال شد');
    }
    showForm.value = false;
    form.title = '';
    form.body = '';
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function remove(id: string) {
  try {
    await api(`/announcements/${id}`, { method: 'DELETE' });
    toast.success('حذف شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

onMounted(load);
useHead({ title: 'اطلاعیه‌ها و اعلان مدیریت' });
</script>

<template>
  <div>
    <UiPageHeader
      eyebrow="ارتباطات"
      title="اطلاعیه‌ها و اعلان"
      subtitle="پیام سازمانی بگذارید یا اعلان فوری برای کارکنان بفرستید"
    >
      <template #actions>
        <button
          v-if="auth.can('notifications.create')"
          class="btn-secondary"
          type="button"
          @click="showForm = true; broadcastMode = true"
        >
          <AppIcon name="lucide:megaphone" size="sm" />
          اعلان فوری
        </button>
        <button
          v-if="auth.can('announcements.create')"
          class="btn-primary"
          type="button"
          @click="showForm = true; broadcastMode = false"
        >
          <AppIcon name="lucide:newspaper" size="sm" />
          اطلاعیه جدید
        </button>
      </template>
    </UiPageHeader>

    <UiHelpBanner
      storage-key="announcements"
      title="تفاوت اطلاعیه و اعلان فوری"
      :steps="[
        'اطلاعیه روی داشبورد می‌ماند و همه می‌توانند بعداً ببینند.',
        'اعلان فوری فقط پیام فوری می‌فرستد (پنل و در صورت اتصال، تلگرام).',
        'با «مخاطب» مشخص کنید پیام برای همه باشد یا فقط یک نقش.',
      ]"
    />

    <div v-if="showForm" class="card mb-4 p-4">
      <h2 class="mb-1 font-semibold">{{ broadcastMode ? 'ارسال اعلان فوری' : 'ثبت اطلاعیه' }}</h2>
      <p class="mb-3 text-xs" style="color: var(--hr-muted)">
        {{ broadcastMode ? 'متن کوتاه و واضح بنویسید تا سریع خوانده شود.' : 'عنوان جذاب و متن کامل بنویسید.' }}
      </p>
      <div class="grid gap-3 md:grid-cols-2">
        <div class="md:col-span-2">
          <label class="field-label">عنوان</label>
          <input
            v-model="form.title"
            class="input-field"
            :class="{ 'input-invalid': errors.title }"
            placeholder="مثال: تعطیلی پنجشنبه"
            maxlength="120"
            @input="clearField('title')"
          />
          <UiFieldError :message="errors.title" />
        </div>
        <div class="md:col-span-2">
          <label class="field-label">متن</label>
          <textarea
            v-model="form.body"
            class="input-field min-h-[100px]"
            :class="{ 'input-invalid': errors.body }"
            placeholder="جزئیات پیام برای کارکنان…"
            @input="clearField('body')"
          />
          <UiFieldError :message="errors.body" />
        </div>
        <div>
          <label class="field-label">مخاطب</label>
          <select v-model="form.audience" class="input-field">
            <option value="ACTIVE_EMPLOYEES">همه کارکنان فعال</option>
            <option value="ALL">همه کاربران فعال</option>
            <option value="ROLE">بر اساس نقش</option>
          </select>
          <UiFieldHint text="معمولاً «همه کارکنان فعال» کافی است." />
        </div>
        <div v-if="form.audience === 'ROLE'">
          <label class="field-label">نقش</label>
          <select
            v-model="form.roleId"
            class="input-field"
            :class="{ 'input-invalid': errors.roleId }"
            @change="clearField('roleId')"
          >
            <option value="">انتخاب نقش</option>
            <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
          <UiFieldError :message="errors.roleId" />
        </div>
        <label v-if="!broadcastMode" class="flex items-center gap-2 text-sm md:col-span-2">
          <input v-model="form.isPinned" type="checkbox" /> سنجاق‌شده (بالای لیست بماند)
        </label>
        <label v-if="!broadcastMode" class="flex items-center gap-2 text-sm md:col-span-2">
          <input v-model="form.sendNotification" type="checkbox" /> همزمان اعلان هم بفرست
        </label>
      </div>
      <div class="mt-4 flex gap-2">
        <button class="btn-primary" type="button" @click="submit">ارسال</button>
        <button class="btn-secondary" type="button" @click="showForm = false">انصراف</button>
      </div>
    </div>

    <LoadingSpinner v-if="loading" />
    <EmptyState
      v-else-if="!items.length"
      title="اطلاعیه‌ای نیست"
      message="هنوز چیزی منتشر نشده"
      tip="با «اطلاعیه جدید» اولین پیام سازمانی را بگذارید."
      icon="lucide:megaphone-off"
    />
    <div v-else class="space-y-3">
      <div v-for="row in items" :key="row.id" class="card p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-semibold">
              <AppIcon v-if="row.isPinned" name="lucide:pin" size="xs" class="me-1 inline text-amber-600" />
              {{ row.title }}
            </p>
            <p class="mt-2 text-sm whitespace-pre-wrap" style="color: var(--hr-muted)">{{ row.body }}</p>
            <p class="mt-2 text-xs" style="color: var(--hr-muted)">
              {{ formatDate(row.publishAt || row.createdAt) }}
              · مخاطب: {{ row.audience }}
            </p>
          </div>
          <button
            v-if="auth.can('announcements.delete')"
            class="text-xs text-red-600"
            type="button"
            @click="remove(row.id)"
          >
            حذف
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
