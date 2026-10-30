<script setup lang="ts">
definePageMeta({ layout: false });

const auth = useAuthStore();
const theme = useTheme();
const toast = useToast();
const route = useRoute();
const apiBase = useApiBase();
const username = ref('owner');
const password = ref('');
const showPassword = ref(false);
const error = ref('');
const errorField = ref<'username' | 'password' | null>(null);
const loading = ref(false);

onMounted(() => {
  theme.loadLocal();
});
const panelLock = ref<{
  locked: boolean;
  lockedByUsername: string | null;
  message: string | null;
} | null>(null);

if (auth.isLoggedIn) {
  auth.hydrate();
  if (!auth.user) {
    try {
      await auth.fetchMe(true);
    } catch {
      await auth.logout();
    }
  }
  if (auth.isLoggedIn) {
    await navigateTo(auth.homePath());
  }
}

onMounted(async () => {
  try {
    const res = await $fetch<{ success: boolean; data: any }>(`${apiBase.value}/auth/panel-status`);
    panelLock.value = res.data;
  } catch {
    /* ignore */
  }
});

function mapLoginError(err: {
  data?: {
    message?: string;
    code?: string;
    errors?: { field?: string; path?: (string | number)[]; message?: string }[];
  };
  message?: string;
  statusCode?: number;
}) {
  const code = err?.data?.code;
  const msg = err?.data?.message || err?.message || 'ورود ناموفق بود';

  if (code === 'INVALID_PASSWORD' || code === 'PASSWORD_REQUIRED') {
    return { message: msg || 'رمز عبور نادرست است', field: 'password' as const };
  }
  if (code === 'USER_NOT_FOUND' || code === 'ACCOUNT_DISABLED') {
    return { message: msg, field: 'username' as const };
  }
  if (code === 'PANEL_LOCKED') {
    return { message: msg, field: null };
  }

  // Zod validation errors from API ({ field, message })
  const first = err?.data?.errors?.[0];
  const fieldName = first?.field || (Array.isArray(first?.path) ? String(first?.path[0] || '') : '');
  if (fieldName === 'password') {
    return { message: first?.message || 'رمز عبور را وارد کنید', field: 'password' as const };
  }
  if (fieldName === 'username') {
    return { message: first?.message || 'نام کاربری را وارد کنید', field: 'username' as const };
  }

  // Fallback: generic validation / credentials message mentioning password
  if (/رمز/.test(msg)) {
    return { message: msg, field: 'password' as const };
  }

  return { message: msg, field: null };
}

async function submit() {
  error.value = '';
  errorField.value = null;

  if (!username.value.trim()) {
    error.value = 'نام کاربری را وارد کنید';
    errorField.value = 'username';
    return;
  }
  if (!password.value) {
    error.value = 'رمز عبور را وارد کنید';
    errorField.value = 'password';
    return;
  }

  loading.value = true;
  try {
    await auth.login(username.value.trim(), password.value);
    toast.success('ورود موفق');
    const redirect = (route.query.redirect as string) || '';
    if (redirect.startsWith('/') && redirect !== '/login') {
      const { requiredPermissionForPath } = await import('~/utils/routePermissions');
      const need = requiredPermissionForPath(redirect);
      if (!need || auth.can(need)) {
        await navigateTo(redirect);
        return;
      }
    }
    await navigateTo(auth.homePath());
  } catch (e: unknown) {
    const mapped = mapLoginError(e as any);
    error.value = mapped.message;
    errorField.value = mapped.field;
    if ((e as { data?: { code?: string } })?.data?.code === 'PANEL_LOCKED') {
      try {
        const res = await $fetch<{ success: boolean; data: any }>(`${apiBase.value}/auth/panel-status`);
        panelLock.value = res.data;
      } catch {
        /* ignore */
      }
    }
  } finally {
    loading.value = false;
  }
}

useHead({ title: 'ورود | فروشگاه سامی' });
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4" style="background: var(--hr-surface); color: var(--hr-text)">
    <div
      class="absolute inset-0 opacity-50"
      style="background: radial-gradient(circle at 15% 20%, color-mix(in srgb, var(--hr-primary) 22%, transparent) 0, transparent 42%), radial-gradient(circle at 85% 10%, color-mix(in srgb, var(--hr-accent) 18%, transparent) 0, transparent 34%)"
    />
    <form
      class="card relative w-full max-w-md p-8"
      style="box-shadow: var(--ds-shadow-lg)"
      @submit.prevent="submit"
    >
      <div class="mb-6 flex items-center gap-3">
        <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-sm">
          <AppIcon name="lucide:briefcase-business" size="md" />
        </div>
        <div>
          <p class="page-header__eyebrow">فروشگاه سامی</p>
          <h1 class="text-lg font-bold tracking-tight">ورود به پنل</h1>
        </div>
      </div>

      <div v-if="panelLock?.locked" class="alert-error mb-4">
        <div class="flex items-start gap-2">
          <AppIcon name="lucide:lock" size="sm" class="mt-0.5 shrink-0" />
          <div>
            <p class="font-medium">پنل قفل است</p>
            <p class="mt-0.5 text-xs leading-5" style="opacity: 0.9">
              {{ panelLock.message || 'فقط مدیر قفل‌کننده می‌تواند وارد شود.' }}
              <span v-if="panelLock.lockedByUsername"> (قفل‌کننده: @{{ panelLock.lockedByUsername }})</span>
            </p>
          </div>
        </div>
      </div>

      <div v-if="error && !errorField" class="alert-error mb-4">
        {{ error }}
      </div>

      <p class="mb-5 text-sm leading-relaxed" style="color: var(--hr-muted)">
        نام کاربری و رمزی که مدیر برایتان ساخته را وارد کنید. اگر رمز را نمی‌دانید با مدیر فروشگاه تماس بگیرید.
      </p>

      <label class="field-label" for="login-username">نام کاربری</label>
      <input
        id="login-username"
        v-model="username"
        class="input-field mb-1"
        :class="{ 'input-invalid': errorField === 'username' }"
        autocomplete="username"
        placeholder="مثال: owner"
        required
        @input="errorField === 'username' && ((error = ''), (errorField = null))"
      />
      <p v-if="errorField === 'username'" class="field-error mb-3">{{ error }}</p>
      <p v-else class="field-hint mb-3">معمولاً انگلیسی و بدون فاصله است.</p>

      <label class="field-label" for="login-password">رمز عبور</label>
      <div class="password-field" :class="{ 'password-field--invalid': errorField === 'password' }">
        <input
          id="login-password"
          v-model="password"
          class="input-field password-field__input"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          required
          @input="errorField === 'password' && ((error = ''), (errorField = null))"
        />
        <button
          class="password-field__toggle"
          type="button"
          :title="showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'"
          :aria-label="showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'"
          @click="showPassword = !showPassword"
        >
          <AppIcon :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'" size="md" />
        </button>
      </div>
      <p v-if="errorField === 'password'" class="field-error mt-1">{{ error }}</p>

      <button class="btn-primary mt-6 w-full" type="submit" :disabled="loading">
        <AppIcon v-if="loading" name="lucide:loader-2" size="sm" class="animate-spin" />
        {{ loading ? 'در حال ورود...' : 'ورود' }}
      </button>

      <button
        class="btn-ghost mt-3 w-full text-xs"
        type="button"
        @click="theme.toggleDark()"
      >
        <AppIcon :name="theme.state.value.dark ? 'lucide:sun' : 'lucide:moon'" size="sm" />
        {{ theme.state.value.dark ? 'حالت روشن' : 'حالت تاریک' }}
      </button>
    </form>
    <ClientOnly>
      <AppToast />
    </ClientOnly>
  </div>
</template>

<style scoped>
.password-field {
  position: relative;
  display: flex;
  align-items: center;
}
.password-field__input {
  width: 100%;
  padding-inline-end: 2.75rem;
}
.password-field__toggle {
  position: absolute;
  inset-inline-end: 0.35rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: 0.6rem;
  background: transparent;
  color: var(--hr-muted);
  cursor: pointer;
}
.password-field__toggle:hover {
  color: var(--hr-text);
  background: color-mix(in srgb, var(--hr-primary) 10%, transparent);
}
.password-field--invalid .password-field__input,
.input-invalid {
  border-color: color-mix(in srgb, #dc2626 70%, var(--hr-border)) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, #dc2626 16%, transparent);
}
.field-error {
  font-size: 0.75rem;
  line-height: 1.4;
  color: #dc2626;
}
html.dark .field-error {
  color: #f87171;
}
</style>
