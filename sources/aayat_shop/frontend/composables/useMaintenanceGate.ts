export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
}

const DEFAULT_MESSAGE = 'آتلیه در حال دوخت و پرداخت است. چند لحظه دیگر برمی‌گردیم.';

/** وضعیت حالت تعمیر — مشترک بین middleware و صفحه */
export function useMaintenanceGate() {
  const enabled = useState('maintenance-enabled', () => false);
  const message = useState('maintenance-message', () => DEFAULT_MESSAGE);
  const checkedAt = useState('maintenance-checked-at', () => 0);

  const authStore = useAuthStore();

  function canBypassMaintenance() {
    authStore.init();
    return authStore.isAdmin;
  }

  async function fetchStatus(force = false): Promise<MaintenanceStatus> {
    const now = Date.now();
    if (!force && checkedAt.value && now - checkedAt.value < 8_000) {
      return { enabled: enabled.value, message: message.value };
    }

    try {
      const config = useRuntimeConfig();
      const apiBase = String(config.public.apiBase || '').replace(/\/$/, '');
      const res = await $fetch<{ data?: MaintenanceStatus }>(`${apiBase}/settings/maintenance`, {
        cache: 'no-store',
      });
      enabled.value = res?.data?.enabled === true;
      message.value =
        typeof res?.data?.message === 'string' && res.data.message.trim()
          ? res.data.message.trim()
          : DEFAULT_MESSAGE;
      checkedAt.value = now;
    } catch {
      // در خطا فروشگاه باز بماند
      if (!checkedAt.value) {
        enabled.value = false;
      }
      checkedAt.value = now;
    }

    return { enabled: enabled.value, message: message.value };
  }

  function invalidate() {
    checkedAt.value = 0;
  }

  return {
    enabled,
    message,
    canBypassMaintenance,
    fetchStatus,
    invalidate,
  };
}
