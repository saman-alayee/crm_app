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
const ready = ref(false);

onMounted(() => {
  theme.loadLocal();
  requestAnimationFrame(() => {
    ready.value = true;
  });
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

  const first = err?.data?.errors?.[0];
  const fieldName = first?.field || (Array.isArray(first?.path) ? String(first?.path[0] || '') : '');
  if (fieldName === 'password') {
    return { message: first?.message || 'رمز عبور را وارد کنید', field: 'password' as const };
  }
  if (fieldName === 'username') {
    return { message: first?.message || 'نام کاربری را وارد کنید', field: 'username' as const };
  }

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
  <div class="login" :class="{ 'login--ready': ready }" style="color: var(--hr-text)">
    <div class="login__stage" aria-hidden="true">
      <div class="login__mesh" />
      <div class="login__orb login__orb--a" />
      <div class="login__orb login__orb--b" />
      <div class="login__orb login__orb--c" />
      <div class="login__grid" />
    </div>

    <div class="login__shell">
      <aside class="login__brand login-rise" style="--i: 0">
        <div class="login__mark">
          <AppIcon name="lucide:store" size="lg" />
        </div>
        <p class="login__brand-name">فروشگاه سامی</p>
        <p class="login__brand-line">پنل کارکنان</p>
        <div class="login__brand-rule" />
        <p class="login__brand-note">مدیریت پرسنل، مرخصی و عملیات روزانه</p>
      </aside>

      <form class="login__panel login-rise" style="--i: 1" @submit.prevent="submit">
        <header class="login__panel-head">
          <h1 class="login__title">ورود</h1>
          <button
            class="login__theme"
            type="button"
            :title="theme.state.value.dark ? 'حالت روشن' : 'حالت تاریک'"
            @click="theme.toggleDark()"
          >
            <AppIcon :name="theme.state.value.dark ? 'lucide:sun' : 'lucide:moon'" size="sm" />
          </button>
        </header>

        <div v-if="panelLock?.locked" class="login__alert">
          <AppIcon name="lucide:lock" size="sm" class="shrink-0" />
          <div>
            <p class="font-medium">پنل قفل است</p>
            <p class="login__alert-sub">
              {{ panelLock.message || 'فقط مدیر قفل‌کننده می‌تواند وارد شود.' }}
              <span v-if="panelLock.lockedByUsername"> (@{{ panelLock.lockedByUsername }})</span>
            </p>
          </div>
        </div>

        <div v-if="error && !errorField" class="login__alert">{{ error }}</div>

        <div class="login__fields">
          <div>
            <label class="field-label" for="login-username">نام کاربری</label>
            <input
              id="login-username"
              v-model="username"
              class="input-field login__input"
              :class="{ 'input-invalid': errorField === 'username' }"
              autocomplete="username"
              required
              @input="errorField === 'username' && ((error = ''), (errorField = null))"
            />
            <p v-if="errorField === 'username'" class="field-error">{{ error }}</p>
          </div>

          <div>
            <label class="field-label" for="login-password">رمز عبور</label>
            <div class="password-field" :class="{ 'password-field--invalid': errorField === 'password' }">
              <input
                id="login-password"
                v-model="password"
                class="input-field password-field__input login__input"
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
            <p v-if="errorField === 'password'" class="field-error">{{ error }}</p>
          </div>
        </div>

        <button class="btn-primary login__submit" type="submit" :disabled="loading">
          <AppIcon v-if="loading" name="lucide:loader-2" size="sm" class="animate-spin" />
          <span>{{ loading ? 'در حال ورود…' : 'ورود به پنل' }}</span>
          <AppIcon v-if="!loading" name="lucide:arrow-left" size="sm" class="login__submit-arrow" />
        </button>
      </form>
    </div>

    <ClientOnly>
      <AppToast />
    </ClientOnly>
  </div>
</template>

<style scoped>
.login {
  --login-ink: var(--hr-text);
  --login-soft: color-mix(in srgb, var(--hr-primary) 18%, transparent);
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  overflow: hidden;
  background: var(--hr-surface);
}

.login__stage {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.login__mesh {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 12% 20%, color-mix(in srgb, var(--hr-primary) 28%, transparent), transparent 58%),
    radial-gradient(ellipse 70% 50% at 88% 78%, color-mix(in srgb, var(--hr-accent) 22%, transparent), transparent 55%),
    linear-gradient(160deg, color-mix(in srgb, var(--hr-primary) 6%, var(--hr-surface)), var(--hr-surface) 48%);
}

.login__grid {
  position: absolute;
  inset: 0;
  opacity: 0.22;
  background-image:
    linear-gradient(color-mix(in srgb, var(--hr-border) 55%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--hr-border) 55%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, #000 20%, transparent 75%);
}

.login__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(2px);
  opacity: 0.55;
  animation: login-float 14s ease-in-out infinite;
}
.login__orb--a {
  width: 18rem;
  height: 18rem;
  top: -4rem;
  inset-inline-end: -3rem;
  background: radial-gradient(circle, color-mix(in srgb, var(--hr-primary) 35%, transparent), transparent 68%);
}
.login__orb--b {
  width: 12rem;
  height: 12rem;
  bottom: 8%;
  inset-inline-start: 6%;
  background: radial-gradient(circle, color-mix(in srgb, var(--hr-accent) 40%, transparent), transparent 70%);
  animation-delay: -4s;
  animation-duration: 18s;
}
.login__orb--c {
  width: 8rem;
  height: 8rem;
  top: 42%;
  inset-inline-start: 48%;
  background: radial-gradient(circle, color-mix(in srgb, var(--hr-primary) 22%, transparent), transparent 72%);
  animation-delay: -8s;
  animation-duration: 16s;
}

@keyframes login-float {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(0, -18px, 0) scale(1.04);
  }
}

.login__shell {
  position: relative;
  z-index: 1;
  width: min(920px, 100%);
  display: grid;
  gap: 1.25rem;
}

@media (min-width: 900px) {
  .login__shell {
    grid-template-columns: 1.05fr 0.95fr;
    align-items: stretch;
    gap: 0;
    border-radius: 1.5rem;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--hr-border) 45%, transparent);
    background: color-mix(in srgb, var(--hr-card) 72%, transparent);
    backdrop-filter: blur(16px);
    box-shadow: 0 24px 60px -36px rgba(20, 45, 70, 0.45);
  }
}

.login__brand {
  position: relative;
  padding: 1.75rem 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 11rem;
}

@media (min-width: 900px) {
  .login__brand {
    min-height: 28rem;
    padding: 2.75rem 2.5rem;
    background:
      linear-gradient(145deg, color-mix(in srgb, var(--hr-primary) 88%, #0a3d55), color-mix(in srgb, var(--hr-primary) 55%, #12384a));
    color: #f4fafc;
  }
}

.login__mark {
  width: 3rem;
  height: 3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.95rem;
  margin-bottom: 1.1rem;
  background: color-mix(in srgb, var(--hr-primary) 16%, var(--hr-card));
  color: var(--hr-primary-700);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hr-primary) 18%, transparent);
}

@media (min-width: 900px) {
  .login__mark {
    background: color-mix(in srgb, #fff 16%, transparent);
    color: #fff;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, #fff 22%, transparent);
  }
}

.login__brand-name {
  margin: 0;
  font-family: var(--ds-font-display);
  font-size: clamp(2rem, 4.5vw, 2.75rem);
  font-weight: 750;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.login__brand-line {
  margin: 0.45rem 0 0;
  font-size: 0.95rem;
  opacity: 0.78;
}

.login__brand-rule {
  width: 3rem;
  height: 2px;
  margin: 1.15rem 0 0.9rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--hr-primary) 55%, transparent);
}

@media (min-width: 900px) {
  .login__brand-rule {
    background: color-mix(in srgb, #fff 55%, transparent);
  }
}

.login__brand-note {
  margin: 0;
  max-width: 16rem;
  font-size: 0.82rem;
  line-height: 1.7;
  opacity: 0.72;
}

.login__panel {
  padding: 1.5rem 1.25rem 1.75rem;
  border-radius: 1.25rem;
  background: color-mix(in srgb, var(--hr-card) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--hr-border) 50%, transparent);
  backdrop-filter: blur(12px);
}

@media (min-width: 900px) {
  .login__panel {
    border: 0;
    border-radius: 0;
    background: transparent;
    backdrop-filter: none;
    padding: 2.75rem 2.5rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}

.login__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.login__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.login__theme {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  border: 1px solid color-mix(in srgb, var(--hr-border) 70%, transparent);
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--hr-primary-50) 70%, transparent);
  color: var(--hr-muted);
  cursor: pointer;
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), color 0.2s ease, background 0.2s ease;
}
.login__theme:hover {
  color: var(--hr-primary-700);
  transform: rotate(-12deg) scale(1.06);
}

.login__fields {
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
}

.login__input {
  transition: border-color 0.2s ease, box-shadow 0.25s ease, transform 0.25s ease;
}
.login__input:focus {
  transform: translateY(-1px);
}

.login__alert {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  margin-bottom: 1rem;
  padding: 0.75rem 0.85rem;
  border-radius: 0.85rem;
  font-size: 0.85rem;
  background: var(--hr-danger-bg);
  border: 1px solid var(--hr-danger-border);
  color: var(--hr-danger);
}
.login__alert-sub {
  margin-top: 0.2rem;
  font-size: 0.72rem;
  line-height: 1.55;
  opacity: 0.9;
}

.login__submit {
  width: 100%;
  margin-top: 1.35rem;
  min-height: 2.85rem;
  gap: 0.55rem;
}
.login__submit-arrow {
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.login__submit:hover .login__submit-arrow {
  transform: translateX(-4px);
}

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
  margin-top: 0.35rem;
  font-size: 0.75rem;
  line-height: 1.4;
  color: #dc2626;
}
html.dark .field-error {
  color: #f87171;
}

.login-rise {
  opacity: 0;
  transform: translateY(16px);
  transition:
    opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: calc(var(--i, 0) * 90ms);
}
.login--ready .login-rise {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .login__orb,
  .login-rise,
  .login__theme,
  .login__submit-arrow,
  .login__input {
    animation: none !important;
    transition: none !important;
  }
  .login-rise {
    opacity: 1;
    transform: none;
  }
}
</style>
