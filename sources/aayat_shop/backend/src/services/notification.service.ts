import prisma from '../config/database';
import { AppError } from '../utils/errors';
import type { NotificationType, OrderStatus } from '@prisma/client';

const ORDER_STATUS_MESSAGES: Record<OrderStatus, string> = {
  NEW: 'خرید شما ذخیره شد. هر وقت خواستید از سبد خرید دکمهٔ ارسال را بزنید.',
  REVIEWING: 'سفارش شما در انتظار بررسی روش پرداخت است.',
  PREPARING: 'درخواست ارسال ثبت شد و لباس‌ها در حال بسته‌بندی هستند.',
  SHIPPED: 'پیک سفارش شما را ارسال کرد. به زودی به دستتان می‌رسد.',
  DELIVERED: 'سفارش شما با موفقیت تحویل داده شد.',
  CANCELLED: 'سفارش شما لغو شد.',
};

const ORDER_STATUS_TITLES: Record<OrderStatus, string> = {
  NEW: 'خرید ذخیره شد',
  REVIEWING: 'بررسی پرداخت',
  PREPARING: 'درخواست ارسال',
  SHIPPED: 'ارسال با پیک',
  DELIVERED: 'تحویل سفارش',
  CANCELLED: 'لغو سفارش',
};

export class NotificationService {
  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new AppError(404, 'اعلان یافت نشد');

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async create(data: {
    userId: string;
    title: string;
    message: string;
    type?: NotificationType;
    orderId?: string;
  }) {
    return prisma.notification.create({ data });
  }

  async notifyOrderStatusChange(params: {
    userId: string | null;
    orderId: string;
    orderNumber: string;
    status: OrderStatus;
    note?: string;
  }) {
    if (!params.userId) return null;

    const title = ORDER_STATUS_TITLES[params.status];
    const message = params.note || `${ORDER_STATUS_MESSAGES[params.status]} (شماره سفارش: ${params.orderNumber})`;

    return this.create({
      userId: params.userId,
      title,
      message,
      type: 'ORDER_STATUS',
      orderId: params.orderId,
    });
  }
}

export const notificationService = new NotificationService();
