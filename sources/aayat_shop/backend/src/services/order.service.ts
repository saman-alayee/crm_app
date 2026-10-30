import type { PaymentMethod, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { generateOrderNumber } from '../utils/helpers';
import { cartService } from './cart.service';
import { couponService } from './coupon.service';
import { notificationService } from './notification.service';
import { smsService } from './sms.service';
import { zibalService } from './zibal.service';
import { isShippingMethod, SHIPPING_METHODS, type ShippingMethod } from '../config/shipping';
import { settingsService } from './settings.service';

export type OrderStatus =
  | 'NEW'
  | 'REVIEWING'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['PREPARING', 'CANCELLED'],
  REVIEWING: ['NEW', 'PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  street?: string;
  plaque?: string;
  unit?: string;
  province?: string;
  city?: string;
  postalCode?: string;
  addressId?: string;
  addressTitle?: string;
  deliveryMethod?: ShippingMethod;
  notes?: string;
  couponCode?: string;
  paymentMethod?: PaymentMethod;
}

function buildDeliveryAddress(input: CreateOrderInput & { address?: string }): string {
  if (input.deliveryAddress?.trim()) {
    return input.deliveryAddress.trim();
  }

  if (input.address?.trim()) {
    return input.address.trim();
  }

  const parts = [
    input.province?.trim() ? `استان ${input.province.trim()}` : '',
    input.city?.trim() ? `شهر ${input.city.trim()}` : '',
    input.street?.trim(),
    input.plaque ? `پلاک ${input.plaque}` : '',
    input.unit ? `واحد ${input.unit}` : '',
    input.postalCode ? `کدپستی ${input.postalCode}` : '',
  ].filter(Boolean);

  return parts.join('، ');
}

export class OrderService {
  async createOrder(input: CreateOrderInput, userId: string, sessionId?: string) {
    const cart = await cartService.getCart(userId, sessionId);

    if (cart.items.length === 0) {
      throw new AppError(400, 'سبد خرید خالی است');
    }

    for (const item of cart.items) {
      if (item.quantity > item.stock) {
        throw new AppError(400, `موجودی ${item.name} کافی نیست`);
      }
    }

    const subtotal = cart.totalPrice;
    let discountAmount = 0;
    let totalPrice = subtotal;
    let couponId: string | undefined;
    let couponCode: string | undefined;

    if (input.couponCode) {
      const validation = await couponService.validate(input.couponCode, subtotal, {
        userId,
        customerPhone: input.customerPhone,
      });
      discountAmount = validation.discountAmount;
      totalPrice = validation.totalPrice;
      couponId = validation.couponId;
      couponCode = validation.code;
    }

    if (!isShippingMethod(input.deliveryMethod)) {
      throw new AppError(400, 'روش ارسال را انتخاب کنید');
    }
    const deliveryMethod = input.deliveryMethod;
    const shippingSettings = await settingsService.getShipping();
    const deliveryFee =
      deliveryMethod === 'NATIONWIDE' ? shippingSettings.nationwideFee : SHIPPING_METHODS.PICKUP.fee;
    totalPrice += deliveryFee;

    const paymentMethod: PaymentMethod = input.paymentMethod === 'ZIBAL' || !input.paymentMethod ? 'ZIBAL' : input.paymentMethod;
    const payWithZibal = paymentMethod === 'ZIBAL';
    if (payWithZibal) zibalService.assertConfigured();

    const paymentDetailsToStore = {
      deliveryMethod,
      deliveryFee,
      ...(payWithZibal
        ? { provider: 'zibal', paymentStatus: 'pending' as const, sessionId: sessionId || undefined }
        : {}),
    };

    let deliveryAddress = buildDeliveryAddress(input);
    let addressId: string | null = input.addressId ?? null;
    let addressTitle = input.addressTitle ?? null;
    let deliveryProvince = input.province?.trim() || null;
    let deliveryCity = input.city?.trim() || null;
    let deliveryPostalCode = input.postalCode?.trim() || null;

    if (input.addressId && userId) {
      const savedAddress = await prisma.address.findFirst({
        where: { id: input.addressId, userId },
      });
      if (!savedAddress) {
        throw new AppError(400, 'آدرس انتخاب‌شده معتبر نیست');
      }

      deliveryAddress = savedAddress.address;
      addressId = savedAddress.id;
      addressTitle = savedAddress.title;
      deliveryProvince = savedAddress.province;
      deliveryCity = savedAddress.city;
      deliveryPostalCode = savedAddress.postalCode;
    } else if (!deliveryAddress) {
      throw new AppError(400, 'آدرس ارسال الزامی است');
    }

    const initialStatus: OrderStatus = payWithZibal ? 'REVIEWING' : 'NEW';

    const orderNumber = generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          subtotal,
          discountAmount,
          totalPrice,
          couponCode: couponCode ?? null,
          couponId: couponId ?? null,
          status: initialStatus,
          paymentMethod,
          paymentDetails: paymentDetailsToStore as Prisma.InputJsonValue,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deliveryAddress,
          addressId,
          addressTitle,
          deliveryProvince,
          deliveryCity,
          deliveryPostalCode,
          notes: input.notes,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.effectivePrice,
              name: item.name,
            })),
          },
          statusLogs: {
            create: {
              status: initialStatus,
              note: `نوع ارسال: ${SHIPPING_METHODS[deliveryMethod].label}`,
            },
          },
        },
        include: { items: true },
      });

      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        });
      }

      await tx.cartItem.deleteMany({ where: { cart: { userId } } });
      if (sessionId) {
        await tx.cartItem.deleteMany({ where: { cart: { sessionId } } });
      }

      return newOrder;
    });

    if (!payWithZibal) {
      await notificationService.notifyOrderStatusChange({
        userId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: initialStatus,
      });
    }

    let paymentUrl: string | undefined;
    if (payWithZibal) {
      try {
        paymentUrl = await zibalService.requestPayment({
          id: order.id,
          orderNumber: order.orderNumber,
          totalPrice: Number(order.totalPrice),
          customerPhone: order.customerPhone,
        });
      } catch (error) {
        await zibalService.failOrder(order.id);
        throw error;
      }
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      subtotal,
      discountAmount,
      totalPrice: Number(order.totalPrice),
      couponCode: order.couponCode,
      status: order.status,
      paymentMethod,
      paymentUrl,
      customerName: order.customerName,
      createdAt: order.createdAt,
    };
  }

  async listHeldOrders(userId: string) {
    const orders = await prisma.order.findMany({
      where: { userId, status: 'NEW' },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((order) => this.formatOrder(order));
  }

  async requestShipment(userId: string, shipDate?: string) {
    const requestedShipDate = shipDate ? assertShipDate(shipDate) : todayTehranIso();
    const orders = await prisma.order.findMany({
      where: { userId, status: 'NEW' },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!orders.length) {
      throw new AppError(400, 'لباس خریداری‌شده‌ای برای ارسال ندارید');
    }

    await prisma.$transaction(async (tx) => {
      for (const order of orders) {
        const details =
          order.paymentDetails && typeof order.paymentDetails === 'object' && !Array.isArray(order.paymentDetails)
            ? (order.paymentDetails as Record<string, unknown>)
            : {};
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'PREPARING',
            paymentDetails: { ...details, requestedShipDate } as Prisma.InputJsonValue,
          },
        });
        await tx.orderStatusLog.create({
          data: {
            orderId: order.id,
            status: 'PREPARING',
            note: 'مشتری با دکمه ارسال، درخواست ارسال ثبت کرد',
          },
        });
      }
    });

    for (const order of orders) {
      await notificationService.notifyOrderStatusChange({
        userId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: 'PREPARING',
      });
      await smsService
        .sendPaidOrderNotices({
          phone: order.customerPhone,
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          itemNames: order.items.map((item) => item.name),
        })
        .catch((error) => console.error('Shipment SMS failed:', error));
    }

    return {
      count: orders.length,
      orderNumbers: orders.map((order) => order.orderNumber),
      requestedShipDate,
    };
  }

  async getUserOrders(userId: string, page = 1, limit = 10) {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where: { userId } }),
    ]);

    return {
      orders: orders.map(this.formatOrder),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrderById(orderId: string, userId?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { select: { image: true, slug: true, barcode: true } } } },
        statusLogs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) throw new AppError(404, 'سفارش یافت نشد');
    if (userId && order.userId !== userId) {
      throw new AppError(403, 'دسترسی غیرمجاز');
    }

    return this.formatOrder(order);
  }

  async getOrderByNumber(orderNumber: string) {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        statusLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) throw new AppError(404, 'سفارش یافت نشد');
    return this.formatOrder(order);
  }

  async getAllOrders(filters: {
    status?: OrderStatus;
    paymentMethod?: PaymentMethod;
    page?: number;
    limit?: number;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { status, paymentMethod, page = 1, limit: rawLimit = 20, search, dateFrom, dateTo } = filters;
    const limit = Math.min(Math.max(rawLimit, 1), 100);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
      };
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: { include: { product: { select: { image: true, slug: true, barcode: true } } } },
          user: { select: { id: true, phone: true, firstName: true, lastName: true } },
          statusLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map(this.formatOrder),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateStatus(orderId: string, status: OrderStatus, note?: string) {
    const current = await prisma.order.findUnique({ where: { id: orderId } });
    if (!current) throw new AppError(404, 'سفارش یافت نشد');

    const allowed = ALLOWED_TRANSITIONS[current.status as OrderStatus];
    if (!allowed.includes(status)) {
      throw new AppError(400, `تغییر وضعیت از ${current.status} به ${status} مجاز نیست`);
    }

    const order = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          status,
          note: note || undefined,
        },
      });

      return tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          statusLogs: { orderBy: { createdAt: 'desc' } },
        },
      });
    });

    if (!order) throw new AppError(404, 'سفارش یافت نشد');

    if (status === 'PREPARING') {
      await smsService.sendOrderPacked(order.customerPhone, order.orderNumber);
    }

    if (status === 'SHIPPED') {
      await smsService.sendOrderShipped(order.customerPhone, order.orderNumber);
    }

    await notificationService.notifyOrderStatusChange({
      userId: order.userId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status,
      note,
    });

    return this.formatOrder(order);
  }

  async sendOrderSms(orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError(404, 'سفارش یافت نشد');

    if (order.status === 'PREPARING') {
      await smsService.sendOrderPacked(order.customerPhone, order.orderNumber);
    } else {
      await smsService.sendOrderShipped(order.customerPhone, order.orderNumber);
    }
    return { sent: true, orderNumber: order.orderNumber };
  }

  async getOrderStats() {
    const [total, newOrders, reviewing, preparing, shipped, delivered, cancelled] =
      await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { status: 'NEW' } }),
        prisma.order.count({ where: { status: 'REVIEWING' } }),
        prisma.order.count({ where: { status: 'PREPARING' } }),
        prisma.order.count({ where: { status: 'SHIPPED' } }),
        prisma.order.count({ where: { status: 'DELIVERED' } }),
        prisma.order.count({ where: { status: 'CANCELLED' } }),
      ]);

    return { total, newOrders, reviewing, preparing, shipped, delivered, cancelled };
  }

  private formatOrder(order: {
    id: string;
    orderNumber: string;
    userId: string | null;
    subtotal?: number | null;
    discountAmount?: number | null;
    couponCode?: string | null;
    totalPrice: { toNumber?: () => number } | number | bigint;
    status: OrderStatus;
    paymentMethod?: PaymentMethod;
    paymentDetails?: unknown;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    addressId?: string | null;
    addressTitle?: string | null;
    deliveryLatitude?: number | null;
    deliveryLongitude?: number | null;
    notes?: string | null;
    createdAt: Date;
    updatedAt: Date;
    items?: Array<{
      id: string;
      productId: string;
      quantity: number;
      price: { toNumber?: () => number } | number | bigint;
      name: string;
      product?: { image: string | null; slug: string; barcode?: string | null };
    }>;
    user?: { id: string; phone: string; firstName: string | null; lastName: string | null } | null;
    statusLogs?: Array<{ id: string; status: OrderStatus; note: string | null; createdAt: Date }>;
  }) {
    return {
      ...order,
      subtotal: order.subtotal != null ? Number(order.subtotal) : Number(order.totalPrice),
      discountAmount: Number(order.discountAmount ?? 0),
      totalPrice: Number(order.totalPrice),
      items: order.items?.map((item) => ({
        ...item,
        price: Number(item.price),
        subtotal: Number(item.price) * item.quantity,
      })),
    };
  }
}

function todayTehranIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function assertShipDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, 'تاریخ نامعتبر است');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new AppError(400, 'تاریخ نامعتبر است');
  }
  const today = todayTehranIso();
  if (value < today) {
    throw new AppError(400, 'تاریخ نمی‌تواند گذشته باشد');
  }
  return value;
}

export const orderService = new OrderService();
