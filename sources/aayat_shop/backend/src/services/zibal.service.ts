import prisma from '../config/database';
import { config } from '../config';
import { AppError } from '../utils/errors';
import { cartService } from './cart.service';
import { notificationService } from './notification.service';

const REQUEST_URL = 'https://gateway.zibal.ir/v1/request';
const VERIFY_URL = 'https://gateway.zibal.ir/v1/verify';

type PaymentDetails = {
  deliveryMethod?: string;
  deliveryFee?: number;
  provider?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  trackId?: string;
  refNumber?: string;
  sessionId?: string;
};

type ZibalResponse = {
  result?: number;
  message?: string;
  status?: number | string;
  trackId?: number | string;
  amount?: number;
  refNumber?: string | number;
};

function isPaidStatus(status: unknown): boolean {
  const value = String(status ?? '');
  return value === '1' || value === '2';
}

function asDetails(value: unknown): PaymentDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as PaymentDetails;
}

function callbackUrl(): string {
  if (config.zibal.callbackUrl) return config.zibal.callbackUrl;
  return `${config.apiPublicUrl}/api/payments/zibal/callback`;
}

export class ZibalService {
  assertConfigured() {
    if (!config.zibal.merchant) {
      throw new AppError(503, 'درگاه زیبال پیکربندی نشده است', 'ZIBAL_NOT_CONFIGURED');
    }
  }

  async requestPayment(order: {
    id: string;
    orderNumber: string;
    totalPrice: number;
    customerPhone: string;
  }): Promise<string> {
    this.assertConfigured();
    const amount = order.totalPrice * 10;
    if (!Number.isFinite(amount) || amount < 1000) {
      throw new AppError(400, 'مبلغ سفارش برای پرداخت زیبال کافی نیست');
    }

    let response: Response;
    try {
      response = await fetch(REQUEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: config.zibal.merchant,
          amount,
          callbackUrl: callbackUrl(),
          description: `سفارش ${order.orderNumber}`,
          orderId: order.orderNumber,
          mobile: order.customerPhone,
        }),
      });
    } catch (error) {
      console.error('Zibal request failed:', error);
      throw new AppError(502, 'اتصال به درگاه زیبال برقرار نشد', 'ZIBAL_REQUEST_FAILED');
    }

    const data = (await response.json().catch(() => ({}))) as ZibalResponse;
    if (!response.ok || data.result !== 100 || !data.trackId) {
      console.error('Zibal request rejected:', data.result, data.message);
      throw new AppError(502, 'شروع پرداخت زیبال ناموفق بود', 'ZIBAL_REQUEST_FAILED');
    }

    const current = await prisma.order.findUnique({ where: { id: order.id } });
    const details = asDetails(current?.paymentDetails);
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentDetails: {
          ...details,
          provider: 'zibal',
          paymentStatus: 'pending',
          trackId: String(data.trackId),
        },
      },
    });

    return `https://gateway.zibal.ir/start/${data.trackId}`;
  }

  async failOrder(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.status === 'CANCELLED') return;
    const details = asDetails(order.paymentDetails);
    if (details.paymentStatus === 'paid' || details.paymentStatus === 'failed') return;

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      if (order.couponId) {
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { decrement: 1 } },
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          paymentDetails: { ...details, provider: 'zibal', paymentStatus: 'failed' },
        },
      });
      await tx.orderStatusLog.create({
        data: { orderId: order.id, status: 'CANCELLED', note: 'پرداخت زیبال انجام نشد' },
      });
    });

    for (const item of order.items) {
      await cartService
        .addItem(order.userId ?? undefined, details.sessionId, item.productId, item.quantity)
        .catch(() => undefined);
    }
  }

  async handleCallback(query: {
    success?: string;
    status?: string;
    trackId?: string;
    orderId?: string;
  }): Promise<string> {
    const orderNumber = query.orderId || '';
    const order = orderNumber
      ? await prisma.order.findUnique({ where: { orderNumber }, include: { items: true } })
      : null;

    const successPage = (number: string) =>
      `${config.frontendUrl}/orders/success?number=${encodeURIComponent(number)}&paid=1`;
    const failPage = `${config.frontendUrl}/checkout?payment=failed`;

    if (!order) return failPage;

    const details = asDetails(order.paymentDetails);
    if (details.paymentStatus === 'paid') return successPage(order.orderNumber);
    const callbackPaid = query.success === '1' && Boolean(query.trackId) && isPaidStatus(query.status);
    if (!callbackPaid) {
      console.error('Zibal callback rejected:', query.success, query.status, query.orderId);
      await this.failOrder(order.id);
      return `${failPage}&number=${encodeURIComponent(order.orderNumber)}`;
    }
    if (details.trackId && details.trackId !== String(query.trackId)) {
      await this.failOrder(order.id);
      return `${failPage}&number=${encodeURIComponent(order.orderNumber)}`;
    }

    let response: Response;
    try {
      response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: config.zibal.merchant,
          trackId: query.trackId,
        }),
      });
    } catch (error) {
      console.error('Zibal verify failed:', error);
      return `${failPage}&number=${encodeURIComponent(order.orderNumber)}`;
    }

    const data = (await response.json().catch(() => ({}))) as ZibalResponse;
    const verified = data.result === 100 || data.result === 201;
    const statusOk = data.status == null || data.status === '' || isPaidStatus(data.status);
    const expectedRial = order.totalPrice * 10;
    if (!verified || !statusOk || Number(data.amount) !== expectedRial) {
      console.error('Zibal verify rejected:', data.result, data.message);
      await this.failOrder(order.id);
      return `${failPage}&number=${encodeURIComponent(order.orderNumber)}`;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'NEW',
        paymentDetails: {
          ...details,
          provider: 'zibal',
          paymentStatus: 'paid',
          trackId: String(query.trackId),
          refNumber: data.refNumber != null ? String(data.refNumber) : undefined,
        },
      },
    });
    await prisma.orderStatusLog.create({
      data: { orderId: order.id, status: 'NEW', note: 'پرداخت شد و تا درخواست ارسال مشتری نگه داشته شد' },
    });

    if (order.userId) {
      await notificationService.notifyOrderStatusChange({
        userId: order.userId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: 'NEW',
      });
    }

    return successPage(order.orderNumber);
  }
}

export const zibalService = new ZibalService();
