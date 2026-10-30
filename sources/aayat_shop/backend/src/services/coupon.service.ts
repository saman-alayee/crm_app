import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { formatPrice } from '../utils/helpers';
import { normalizePhone } from '../utils/normalize';
import type { CouponType } from '@prisma/client';

export interface CouponValidationResult {
  couponId: string;
  code: string;
  type: CouponType;
  discountAmount: number;
  subtotal: number;
  totalPrice: number;
}

export interface CouponUsageContext {
  userId?: string;
  customerPhone?: string;
}

export class CouponService {
  async getAll(includeInactive = false) {
    return prisma.coupon.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new AppError(404, 'کد تخفیف یافت نشد');
    return coupon;
  }

  async create(data: {
    code: string;
    title?: string;
    type: CouponType;
    value: number;
    minPurchase?: number;
    maxDiscount?: number | null;
    usageLimit?: number | null;
    perUserLimit?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
    isActive?: boolean;
  }) {
    const code = data.code.trim().toUpperCase();
    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) throw new AppError(400, 'این کد تخفیف قبلاً ثبت شده است');

    this.validateValues(data.type, data.value, data.maxDiscount, data.perUserLimit);

    return prisma.coupon.create({
      data: {
        code,
        title: data.title,
        type: data.type,
        value: data.value,
        minPurchase: data.minPurchase ?? 0,
        maxDiscount: data.maxDiscount ?? null,
        usageLimit: data.usageLimit ?? null,
        perUserLimit: data.perUserLimit ?? null,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(
    id: string,
    data: {
      code?: string;
      title?: string;
      type?: CouponType;
      value?: number;
      minPurchase?: number;
      maxDiscount?: number | null;
      usageLimit?: number | null;
      perUserLimit?: number | null;
      startDate?: Date | null;
      endDate?: Date | null;
      isActive?: boolean;
    }
  ) {
    const coupon = await this.getById(id);
    const type = data.type ?? coupon.type;
    const value = data.value ?? coupon.value;
    const maxDiscount = data.maxDiscount !== undefined ? data.maxDiscount : coupon.maxDiscount;
    const perUserLimit = data.perUserLimit !== undefined ? data.perUserLimit : coupon.perUserLimit;

    if (data.code) {
      const code = data.code.trim().toUpperCase();
      const existing = await prisma.coupon.findFirst({ where: { code, NOT: { id } } });
      if (existing) throw new AppError(400, 'این کد تخفیف قبلاً ثبت شده است');
      data.code = code;
    }

    this.validateValues(type, value, maxDiscount, perUserLimit);

    return prisma.coupon.update({
      where: { id },
      data: {
        ...data,
        code: data.code ? data.code : undefined,
      },
    });
  }

  async delete(id: string) {
    await this.getById(id);
    await prisma.coupon.update({ where: { id }, data: { isActive: false } });
  }

  async validate(
    code: string,
    subtotal: number,
    context?: CouponUsageContext
  ): Promise<CouponValidationResult> {
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!coupon || !coupon.isActive) {
      throw new AppError(400, 'کد تخفیف نامعتبر است');
    }

    const now = new Date();
    if (coupon.startDate && coupon.startDate > now) {
      throw new AppError(400, 'کد تخفیف هنوز فعال نشده است');
    }
    if (coupon.endDate && coupon.endDate < now) {
      throw new AppError(400, 'کد تخفیف منقضی شده است');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new AppError(400, 'ظرفیت استفاده از این کد تخفیف تکمیل شده است');
    }
    if (subtotal < coupon.minPurchase) {
      throw new AppError(
        400,
        `حداقل مبلغ خرید برای این کد ${formatPrice(coupon.minPurchase)} تومان است`
      );
    }

    await this.assertPerUserLimit(coupon.id, coupon.perUserLimit, context);

    const discountAmount = this.calculateDiscount(coupon.type, coupon.value, subtotal, coupon.maxDiscount);
    const totalPrice = Math.max(subtotal - discountAmount, 0);

    return {
      couponId: coupon.id,
      code: coupon.code,
      type: coupon.type,
      discountAmount,
      subtotal,
      totalPrice,
    };
  }

  calculateDiscount(type: CouponType, value: number, subtotal: number, maxDiscount: number | null) {
    if (type === 'PERCENT') {
      let discount = Math.round(subtotal * (value / 100));
      if (maxDiscount !== null && discount > maxDiscount) {
        discount = maxDiscount;
      }
      return discount;
    }
    return Math.min(value, subtotal);
  }

  async incrementUsage(couponId: string) {
    await prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
  }

  private async assertPerUserLimit(
    couponId: string,
    perUserLimit: number | null,
    context?: CouponUsageContext
  ) {
    if (perUserLimit === null) return;

    if (!context?.userId && !context?.customerPhone) {
      throw new AppError(400, 'برای استفاده از این کد، شماره موبایل خود را وارد کنید');
    }

    const usageCount = await this.getUserUsageCount(couponId, context);
    if (usageCount >= perUserLimit) {
      throw new AppError(400, `شما حداکثر ${perUserLimit} بار می‌توانید از این کد استفاده کنید`);
    }
  }

  private async getUserUsageCount(couponId: string, context?: CouponUsageContext) {
    if (!context?.userId && !context?.customerPhone) return 0;

    const where: {
      couponId: string;
      status: { not: 'CANCELLED' };
      userId?: string;
      customerPhone?: string;
    } = {
      couponId,
      status: { not: 'CANCELLED' },
    };

    if (context.userId) {
      where.userId = context.userId;
    } else if (context.customerPhone) {
      where.customerPhone = normalizePhone(context.customerPhone);
    }

    return prisma.order.count({ where });
  }

  private validateValues(
    type: CouponType,
    value: number,
    maxDiscount?: number | null,
    perUserLimit?: number | null
  ) {
    if (type === 'PERCENT' && (value < 1 || value > 99)) {
      throw new AppError(400, 'درصد تخفیف باید بین ۱ تا ۹۹ باشد');
    }
    if (type === 'FIXED' && value <= 0) {
      throw new AppError(400, 'مبلغ تخفیف باید بیشتر از صفر باشد');
    }
    if (maxDiscount !== undefined && maxDiscount !== null && maxDiscount <= 0) {
      throw new AppError(400, 'حداکثر تخفیف باید بیشتر از صفر باشد');
    }
    if (perUserLimit !== undefined && perUserLimit !== null && perUserLimit <= 0) {
      throw new AppError(400, 'سقف استفاده هر کاربر باید بیشتر از صفر باشد');
    }
  }
}

export const couponService = new CouponService();
