<script setup lang="ts">
const { api } = useApi();
const auth = useAuthStore();
const theme = useTheme();
const toast = useToast();
const form = reactive({
  companyName: '',
  timezone: 'Asia/Tehran',
  leaveNotifyManagers: true,
  salaryNotifyManagers: true,
  themePrimary: '#0b6e99',
  themeAccent: '#7ebfd6',
  darkModeDefault: false,
});

const panelLock = ref<{
  locked: boolean;
  lockedBy: string | null;
  lockedByUsername: string | null;
  lockedAt: string | null;
  message: string | null;
} | null>(null);
const lockMessage = ref('');
const lockBusy = ref(false);

/** Single-color presets — accent is derived automatically */
const presets = [
  { name: 'آبی سازمانی', primary: '#0b6e99' },
  { name: 'آبی روشن', primary: '#0284c7' },
  { name: 'فیروزه‌ای', primary: '#0f766e' },
  { name: 'نیلی', primary: '#4338ca' },
  { name: 'زغالی', primary: '#334155' },
];

const canManageLock = computed(() => auth.hasFullAccess && auth.can('settings.edit'));
const canUnlock = computed(() => {
  if (!panelLock.value?.locked) return false;
  if (!canManageLock.value) return false;
  return panelLock.value.lockedBy === auth.user?.id || auth.isOwner;
});

async function load() {
  const [settings, lock] = await Promise.all([
    api<{ success: boolean; data: any }>('/settings'),
    api<{ success: boolean; data: any }>('/settings/panel-lock'),
  ]);
  Object.assign(form, settings.data);
  // Migrate older defaults → current panel blue
  const legacy = new Set(['#6f5644', '#2563eb', '#1d4ed8']);
  if (legacy.has(String(form.themePrimary).toLowerCase())) {
    form.themePrimary = '#0b6e99';
  }
  theme.setPrimary(form.themePrimary);
  form.themeAccent = theme.state.value.accent;
  panelLock.value = lock.data;
  if (lock.data?.message) lockMessage.value = lock.data.message;
}

async function save() {
  try {
    theme.setPrimary(form.themePrimary);
    form.themeAccent = theme.state.value.accent;
    await api('/settings', { method: 'PATCH', body: { ...form } });
    theme.toggleDark(form.darkModeDefault);
    toast.success('تنظیمات ذخیره شد');
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

function applyPreset(p: { primary: string }) {
  form.themePrimary = p.primary;
  theme.setPrimary(p.primary);
  form.themeAccent = theme.state.value.accent;
}

async function lockPanel() {
  if (!canManageLock.value || lockBusy.value) return;
  const ok = window.confirm(
    'با قفل پنل، همه کاربران دیگر از سیستم خارج می‌شوند و فقط شما می‌توانید وارد شوید. ادامه؟'
  );
  if (!ok) return;
  lockBusy.value = true;
  try {
    const res = await api<{ success: boolean; data: any }>('/settings/panel-lock', {
      method: 'POST',
      body: { message: lockMessage.value || undefined },
    });
    panelLock.value = res.data;
    toast.success('پنل قفل شد');
  } catch (e: any) {
    toast.error(e?.data?.message || 'قفل ناموفق بود');
  } finally {
    lockBusy.value = false;
  }
}

async function unlockPanel() {
  if (!canUnlock.value || lockBusy.value) return;
  lockBusy.value = true;
  try {
    const res = await api<{ success: boolean; data: any }>('/settings/panel-unlock', {
      method: 'POST',
    });
    panelLock.value = res.data;
    toast.success('قفل برداشته شد');
  } catch (e: any) {
    toast.error(e?.data?.message || 'باز کردن قفل ناموفق بود');
  } finally {
    lockBusy.value = false;
  }
}

onMounted(load);
useHead({ title: 'تنظیمات' });
</script>

<template>
  <div>
    <UiPageHeader
      class="!mb-4"
      eyebrow="فروشگاه سامی"
      title="تنظیمات"
      subtitle="نام برند، رنگ پنل، اعلان‌ها و قفل ورود"
    />

    <UiHelpBanner
      storage-key="settings"
      title="راهنمای تنظیمات"
      :steps="[
        'نام فروشگاه در بالای پنل دیده می‌شود.',
        'رنگ برند را یک‌بار انتخاب کنید؛ بقیه ظاهر خودکار تنظیم می‌شود.',
        'قفل پنل یعنی فقط شما وارد شوید — برای مواقع حساس.',
        'ربات تلگرام را از همین صفحه وصل کنید تا اعلان‌ها روی گوشی بیاید.',
      ]"
    />

    <div class="grid gap-4 lg:grid-cols-2">
      <UiCard padding="lg">
        <h2 class="mb-1 font-semibold">عمومی</h2>
        <p class="mb-3 text-xs" style="color: var(--hr-muted)">اطلاعات پایه سازمان و اعلان به مدیران</p>
        <div class="space-y-3">
          <div>
            <label class="field-label">نام فروشگاه</label>
            <input v-model="form.companyName" class="input-field" :disabled="!auth.can('settings.edit')" />
          </div>
          <div>
            <label class="field-label">منطقه زمانی</label>
            <input v-model="form.timezone" class="input-field" :disabled="!auth.can('settings.edit')" />
            <UiFieldHint text="معمولاً Asia/Tehran را نگه دارید." />
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.leaveNotifyManagers" type="checkbox" :disabled="!auth.can('settings.edit')" />
            اعلان مرخصی به مدیران
          </label>
          <UiFieldHint text="اگر روشن باشد، درخواست مرخصی جدید به مدیران خبر می‌دهد." />
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.salaryNotifyManagers" type="checkbox" :disabled="!auth.can('settings.edit')" />
            اعلان مالی به مدیران
          </label>
        </div>
      </UiCard>

      <UiCard padding="lg">
        <h2 class="mb-3 font-semibold">تم و ظاهر</h2>
        <div class="mb-4 flex flex-wrap gap-2">
          <button
            v-for="p in presets"
            :key="p.name"
            type="button"
            class="filter-chip"
            :disabled="!auth.can('settings.edit')"
            @click="applyPreset(p)"
          >
            <span class="inline-block h-3 w-3 rounded-full" :style="{ background: p.primary }" />
            {{ p.name }}
          </button>
        </div>
        <div>
          <label class="field-label">رنگ برند (تک‌رنگ)</label>
          <p class="mb-2 text-xs" style="color: var(--hr-muted)">
            فقط یک رنگ انتخاب کنید؛ دکمه‌ها، لینک‌ها و هایلایت‌ها از همان ساخته می‌شوند.
          </p>
          <div class="flex items-center gap-3">
            <input
              v-model="form.themePrimary"
              type="color"
              class="h-12 w-16 cursor-pointer rounded-xl border"
              style="border-color: var(--hr-border)"
              :disabled="!auth.can('settings.edit')"
              @input="
                theme.setPrimary(form.themePrimary);
                form.themeAccent = theme.state.value.accent;
              "
            />
            <code class="rounded-lg px-2 py-1 text-xs" style="background: var(--hr-primary-50); color: var(--hr-link)">
              {{ form.themePrimary }}
            </code>
          </div>
        </div>
        <label class="mt-4 flex items-center gap-2 text-sm">
          <input
            v-model="form.darkModeDefault"
            type="checkbox"
            :disabled="!auth.can('settings.edit')"
            @change="theme.toggleDark(form.darkModeDefault)"
          />
          پیش‌فرض دارک‌مود برای کاربران جدید/بدون تنظیم محلی
        </label>
        <button class="btn-secondary mt-3" type="button" @click="theme.toggleDark()">
          <AppIcon :name="theme.state.value.dark ? 'lucide:sun' : 'lucide:moon'" size="sm" />
          تغییر فوری حالت فعلی
        </button>
      </UiCard>
    </div>

    <UiCard v-if="canManageLock || panelLock?.locked" class="mt-4" padding="lg">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-semibold">قفل پنل</h2>
          <p class="mt-1 max-w-xl text-sm" style="color: var(--hr-muted)">
            با فعال‌سازی، نشست همه کاربران قطع می‌شود و فقط قفل‌کننده می‌تواند وارد پنل شود.
          </p>
        </div>
        <span
          class="badge"
          :class="panelLock?.locked ? 'badge-rejected' : 'badge-neutral'"
        >
          {{ panelLock?.locked ? 'قفل فعال است' : 'باز' }}
        </span>
      </div>

      <div v-if="panelLock?.locked" class="mt-4 rounded-xl px-3 py-2 text-sm" style="background: var(--hr-primary-50)">
        <p>
          قفل توسط
          <strong>@{{ panelLock.lockedByUsername || '—' }}</strong>
          <span v-if="panelLock.lockedAt"> · {{ panelLock.lockedAt }}</span>
        </p>
        <p v-if="panelLock.message" class="mt-1" style="color: var(--hr-muted)">{{ panelLock.message }}</p>
      </div>

      <div v-if="canManageLock && !panelLock?.locked" class="mt-4">
        <label class="field-label">پیام نمایش‌داده‌شده به دیگران</label>
        <input
          v-model="lockMessage"
          class="input-field"
          placeholder="مثلاً: پنل برای نگهداری موقتاً بسته است"
        />
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          v-if="canManageLock && !panelLock?.locked"
          class="btn-primary"
          type="button"
          :disabled="lockBusy"
          @click="lockPanel"
        >
          <AppIcon name="lucide:lock" size="sm" />
          قفل کردن پنل
        </button>
        <button
          v-if="canUnlock"
          class="btn-secondary"
          type="button"
          :disabled="lockBusy"
          @click="unlockPanel"
        >
          <AppIcon name="lucide:unlock" size="sm" />
          باز کردن قفل
        </button>
      </div>
    </UiCard>

    <UiCard class="mt-4" padding="lg">
      <h2 class="mb-1 font-semibold">بات تلگرام</h2>
      <p class="mb-3 text-sm" style="color: var(--hr-muted)">
        همه امکانات پنل از طریق بات در دسترس است و اعلان‌ها فقط برای خودِ همان کاربر ارسال می‌شود.
      </p>
      <ol class="list-decimal space-y-1.5 pe-5 text-sm" style="color: var(--hr-muted)">
        <li>در تلگرام از <code>@BotFather</code> یک بات بسازید و توکن را در <code>TELEGRAM_BOT_TOKEN</code> فایل <code>.env</code> بگذارید.</li>
        <li>API را روشن کنید، سپس در ترمینال: <code>npm run bot:install</code> و <code>npm run dev:bot</code></li>
        <li>بات را باز کنید و <code>/start</code> بزنید؛ با همان نام‌کاربری و رمز پنل وصل شوید.</li>
        <li>بعد از اتصال، منوی داشبورد/مرخصی/مالی/وظایف/اعلان و بقیه ماژول‌ها فعال می‌شود.</li>
      </ol>
      <p class="mt-3 text-xs" style="color: var(--hr-muted)">
        برای قطع اتصال در بات: دستور <code>/unlink</code> یا دکمه «قطع اتصال».
      </p>
    </UiCard>

    <UiCard class="mt-4" padding="lg">
      <h2 class="mb-1 font-semibold">نصب روی گوشی (PWA)</h2>
      <p class="mb-3 text-sm" style="color: var(--hr-muted)">
        پنل به‌صورت Progressive Web App آماده است. روی اندروید از بنر «نصب» یا منوی مرورگر Install app را بزنید.
        روی iPhone در Safari گزینه Share سپس Add to Home Screen را انتخاب کنید.
      </p>
      <ul class="list-disc space-y-1 pe-5 text-xs" style="color: var(--hr-muted)">
        <li>برای نصب واقعی روی گوشی، سایت باید روی HTTPS باشد (مثلاً دیپلوی Netlify).</li>
        <li>در حالت نصب‌شده مثل اپ جداگانه باز می‌شود و آیکون روی صفحه اصلی می‌نشیند.</li>
      </ul>
    </UiCard>

    <button v-if="auth.can('settings.edit')" class="btn-primary mt-5" type="button" @click="save">ذخیره تنظیمات</button>
  </div>
</template>
