/**
 * Polls for newly created orders in the admin panel.
 * Shows toast + banner + sound; unlocks audio after first user gesture.
 */
import { SITE_NAME } from '~/constants/site';

export function useNewOrderAlarm() {
  const api = useApi();
  const toast = useToast();
  const authStore = useAuthStore();
  const router = useRouter();

  const STORAGE_KEY = 'admin-order-alarm-last-seen';

  const enabled = ref(true);
  const lastSeenAt = ref<number | null>(null);
  const pendingCount = ref(0);
  const latestAlert = ref<{ orderNumber: string; id: string } | null>(null);
  const audioUnlocked = ref(false);

  let timer: ReturnType<typeof setInterval> | null = null;
  let audioCtx: AudioContext | null = null;

  function readStoredSeen(): number | null {
    if (!import.meta.client) return null;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function writeStoredSeen(ts: number) {
    if (!import.meta.client) return;
    sessionStorage.setItem(STORAGE_KEY, String(ts));
  }

  function unlockAudio() {
    if (!import.meta.client || audioUnlocked.value) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = audioCtx ?? new Ctx();
      void audioCtx.resume().then(() => {
        audioUnlocked.value = true;
      });
    } catch {
      // ignore
    }
  }

  function playAlarm() {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = audioCtx ?? new Ctx();
      audioCtx = ctx;
      void ctx.resume();
      const now = ctx.currentTime;
      [0, 0.2, 0.4, 0.6].forEach((offset, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = i % 2 === 0 ? 920 : 700;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.18);
      });
    } catch {
      // ignore audio failures (autoplay policies)
    }
  }

  function showBrowserNotification(orderNumber: string) {
    if (!import.meta.client || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    try {
      const n = new Notification(`سفارش جدید — ${SITE_NAME}`, {
        body: `شماره سفارش: ${orderNumber}`,
        tag: `order-${orderNumber}`,
        dir: 'rtl',
        lang: 'fa',
      });
      n.onclick = () => {
        window.focus();
        void router.push('/admin/orders');
        n.close();
      };
    } catch {
      // ignore
    }
  }

  async function requestNotificationPermission() {
    if (!import.meta.client || typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => undefined);
    }
  }

  async function refreshPendingCount() {
    try {
      const { data } = await api.get<{
        orders: { newOrders: number; reviewing: number };
      }>('/admin/stats');
      pendingCount.value = (data.orders?.newOrders ?? 0) + (data.orders?.reviewing ?? 0);
    } catch {
      // silent
    }
  }

  async function check() {
    if (!enabled.value || !authStore.isLoggedIn || !authStore.isAdmin) return;
    try {
      // Any brand-new order (NEW or REVIEWING for installment)
      const { data } = await api.get<{
        orders: { id: string; createdAt: string; orderNumber: string; status: string }[];
      }>('/admin/orders?limit=8');

      const orders = data.orders ?? [];
      await refreshPendingCount();

      if (!orders.length) {
        lastSeenAt.value ??= Date.now();
        writeStoredSeen(lastSeenAt.value);
        return;
      }

      const maxTs = Math.max(...orders.map((o) => new Date(o.createdAt).getTime()));
      const baseline = lastSeenAt.value ?? readStoredSeen();

      if (baseline == null) {
        lastSeenAt.value = maxTs;
        writeStoredSeen(maxTs);
        return;
      }

      const fresh = orders.filter((o) => new Date(o.createdAt).getTime() > baseline);
      if (fresh.length) {
        const newest = fresh[0];
        latestAlert.value = { orderNumber: newest.orderNumber, id: newest.id };
        playAlarm();
        toast.success(
          fresh.length === 1
            ? `سفارش جدید: ${newest.orderNumber}`
            : `${fresh.length} سفارش جدید ثبت شد`
        );
        showBrowserNotification(newest.orderNumber);
      }

      lastSeenAt.value = Math.max(baseline, maxTs);
      writeStoredSeen(lastSeenAt.value);
    } catch {
      // silent — panel may be offline briefly
    }
  }

  function dismissAlert() {
    latestAlert.value = null;
  }

  function openOrders() {
    dismissAlert();
    void navigateTo('/admin/orders');
  }

  function start() {
    if (!import.meta.client) return;
    lastSeenAt.value = readStoredSeen();
    void check();
    timer = setInterval(check, 8000);
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  onMounted(start);
  onBeforeUnmount(stop);

  watch(enabled, (on) => {
    if (on) {
      unlockAudio();
      void requestNotificationPermission();
      void check();
    }
  });

  return {
    enabled,
    pendingCount,
    latestAlert,
    audioUnlocked,
    check,
    playAlarm,
    dismissAlert,
    openOrders,
    unlockAudio,
    requestNotificationPermission,
  };
}
