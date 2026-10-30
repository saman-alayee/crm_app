import { defineStore } from 'pinia';
import { clearApiGetCache } from '~/utils/apiCache';

export type LiveNotification = {
  id: string;
  title: string;
  body: string;
  eventType?: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;
  _flash?: boolean;
};

export const useNotificationsStore = defineStore('notifications', () => {
  const unread = ref(0);
  const items = ref<LiveNotification[]>([]);
  const loading = ref(false);
  const live = ref(false);
  const hydratedList = ref(false);
  let flashTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function setUnread(n: number) {
    unread.value = Math.max(0, n);
  }

  function upsertFront(n: LiveNotification, flash = true) {
    const idx = items.value.findIndex((x) => x.id === n.id);
    const row = { ...n, _flash: flash };
    if (idx >= 0) {
      items.value.splice(idx, 1);
    }
    items.value.unshift(row);
    if (items.value.length > 80) items.value = items.value.slice(0, 80);
    if (flash) {
      const prev = flashTimers.get(n.id);
      if (prev) clearTimeout(prev);
      flashTimers.set(
        n.id,
        setTimeout(() => {
          const target = items.value.find((x) => x.id === n.id);
          if (target) target._flash = false;
          flashTimers.delete(n.id);
        }, 2200)
      );
    }
  }

  function markLocalRead(id: string) {
    const row = items.value.find((x) => x.id === id);
    if (row && !row.isRead) {
      row.isRead = true;
      if (unread.value > 0) unread.value -= 1;
    }
  }

  function markLocalReadAll() {
    for (const row of items.value) row.isRead = true;
    unread.value = 0;
  }

  async function fetchUnread() {
    const auth = useAuthStore();
    if (!auth.can('notifications.view')) {
      unread.value = 0;
      return;
    }
    const { api } = useApi();
    try {
      const res = await api<{ success: boolean; data: { unreadCount: number } }>(
        '/notifications/unread-count',
        { cacheTtlMs: 0 }
      );
      unread.value = res.data.unreadCount;
    } catch {
      /* ignore */
    }
  }

  async function fetchList(limit = 50) {
    const auth = useAuthStore();
    if (!auth.can('notifications.view')) {
      items.value = [];
      return;
    }
    loading.value = true;
    const { api } = useApi();
    try {
      const res = await api<{
        success: boolean;
        data: { items: LiveNotification[]; unreadCount?: number };
      }>(`/notifications?limit=${limit}`, { cacheTtlMs: 0 });
      items.value = (res.data.items || []).map((n) => ({ ...n, _flash: false }));
      if (typeof res.data.unreadCount === 'number') unread.value = res.data.unreadCount;
      hydratedList.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function markRead(id: string) {
    const { api } = useApi();
    markLocalRead(id);
    clearApiGetCache('/notifications');
    await api(`/notifications/${id}/read`, { method: 'POST' });
  }

  async function markAll() {
    const { api } = useApi();
    markLocalReadAll();
    clearApiGetCache('/notifications');
    await api('/notifications/read-all', { method: 'POST' });
  }

  function onSocketNew(payload: { notification: LiveNotification; unreadCount: number }) {
    if (!payload?.notification?.id) return;
    upsertFront({ ...payload.notification, isRead: false }, true);
    if (typeof payload.unreadCount === 'number') setUnread(payload.unreadCount);
    else unread.value += 1;
    clearApiGetCache('/notifications');
  }

  function onSocketSync(payload: { unreadCount: number; readId?: string; readAll?: boolean }) {
    if (typeof payload?.unreadCount === 'number') setUnread(payload.unreadCount);
    if (payload.readAll) markLocalReadAll();
    else if (payload.readId) markLocalRead(payload.readId);
  }

  function reset() {
    unread.value = 0;
    items.value = [];
    live.value = false;
    hydratedList.value = false;
    for (const t of flashTimers.values()) clearTimeout(t);
    flashTimers.clear();
  }

  return {
    unread,
    items,
    loading,
    live,
    hydratedList,
    setUnread,
    fetchUnread,
    fetchList,
    markRead,
    markAll,
    onSocketNew,
    onSocketSync,
    reset,
  };
});
