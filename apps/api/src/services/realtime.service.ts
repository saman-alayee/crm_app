import type { Server, Socket } from 'socket.io';
import { prisma } from '../db/prisma.js';
import { verifyAccessToken } from '../utils/jwt.js';

let io: Server | null = null;

export function setRealtimeServer(server: Server) {
  io = server;
}

export function getRealtimeServer() {
  return io;
}

export function userRoom(userId: string) {
  return `user:${userId}`;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(userId)).emit(event, payload);
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

export async function emitNotificationNew(
  userId: string,
  notification: {
    id: string;
    title: string;
    body: string;
    eventType: string;
    entityType?: string | null;
    entityId?: string | null;
    isRead: boolean;
    createdAt: Date | string;
  }
) {
  const unreadCount = await getUnreadCount(userId);
  emitToUser(userId, 'notification:new', {
    notification: {
      ...notification,
      createdAt:
        notification.createdAt instanceof Date
          ? notification.createdAt.toISOString()
          : notification.createdAt,
    },
    unreadCount,
  });
}

export async function emitUnreadSync(userId: string, extra?: Record<string, unknown>) {
  const unreadCount = await getUnreadCount(userId);
  emitToUser(userId, 'notification:sync', { unreadCount, ...extra });
}

/** Authenticate socket with JWT access token from handshake.auth.token */
export function attachRealtimeAuth(server: Server) {
  server.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (typeof socket.handshake.headers.authorization === 'string' &&
        socket.handshake.headers.authorization.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7)
          : undefined);
      if (!token) {
        return next(new Error('UNAUTHORIZED'));
      }
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true, tokenVersion: true },
      });
      if (!user?.isActive || user.tokenVersion !== payload.tokenVersion) {
        return next(new Error('UNAUTHORIZED'));
      }
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  server.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    if (!userId) {
      socket.disconnect(true);
      return;
    }
    void socket.join(userRoom(userId));

    // Legacy client support — ignore forged subscribe for other users
    socket.on('subscribe', (requestedId: string) => {
      if (requestedId === userId) {
        void socket.join(userRoom(userId));
      }
    });

    socket.emit('realtime:ready', { userId });
  });
}
