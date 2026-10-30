import { io, type Socket } from 'socket.io-client';

export default defineNuxtPlugin((nuxtApp) => {
  const auth = useAuthStore();
  const notif = useNotificationsStore();
  const toast = useToast();
  const socketBase = useSocketBase();

  let socket: Socket | null = null;
  let connecting = false;

  function disconnect() {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
    connecting = false;
    notif.live = false;
  }

  function connect() {
    if (!import.meta.client) return;
    if (!auth.isLoggedIn || !auth.accessToken || !auth.can('notifications.view')) {
      disconnect();
      return;
    }
    if (socket?.connected || connecting) return;
    connecting = true;

    const url = socketBase.value;
    socket = io(url, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token: auth.accessToken },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1200,
      reconnectionDelayMax: 8000,
      timeout: 12000,
    });

    socket.on('connect', () => {
      connecting = false;
      notif.live = true;
      void notif.fetchUnread();
    });

    socket.on('disconnect', () => {
      notif.live = false;
    });

    socket.on('connect_error', () => {
      connecting = false;
      notif.live = false;
    });

    socket.on(
      'notification:new',
      (payload: {
        notification: {
          id: string;
          title: string;
          body: string;
          eventType?: string;
          entityType?: string | null;
          entityId?: string | null;
          isRead: boolean;
          createdAt: string;
        };
        unreadCount: number;
      }) => {
        notif.onSocketNew(payload);
        toast.info(payload.notification?.title || 'اعلان جدید');
      }
    );

    socket.on(
      'notification:sync',
      (payload: { unreadCount: number; readId?: string; readAll?: boolean }) => {
        notif.onSocketSync(payload);
      }
    );
  }

  function refreshConnection() {
    disconnect();
    if (auth.isLoggedIn) connect();
    else notif.reset();
  }

  // Initial
  watch(
    () => [auth.isLoggedIn, auth.accessToken, auth.sessionEpoch] as const,
    () => {
      refreshConnection();
    },
    { immediate: true }
  );

  watch(
    () => socketBase.value,
    () => refreshConnection()
  );

  nuxtApp.hook('app:beforeUnmount', () => {
    disconnect();
  });

  return {
    provide: {
      realtime: {
        connect,
        disconnect,
        getSocket: () => socket,
      },
    },
  };
});
