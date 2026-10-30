import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { normalizePhone } from '../utils/normalize';
import { smsService } from './sms.service';

export class AddressService {
  async getUserAddresses(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(
    userId: string,
    data: {
      title?: string;
      address: string;
      plaque?: string;
      unit?: string;
      province?: string;
      city?: string;
      postalCode?: string;
      isDefault?: boolean;
    }
  ) {
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return prisma.address.create({
      data: { userId, ...data },
    });
  }

  async update(
    userId: string,
    addressId: string,
    data: {
      title?: string;
      address?: string;
      plaque?: string;
      unit?: string;
      province?: string;
      city?: string;
      postalCode?: string;
      isDefault?: boolean;
    }
  ) {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new AppError(404, 'آدرس یافت نشد');

    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return prisma.address.update({
      where: { id: addressId },
      data,
    });
  }

  async delete(userId: string, addressId: string) {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new AppError(404, 'آدرس یافت نشد');
    await prisma.address.delete({ where: { id: addressId } });
  }
}

export class CustomerService {
  async getAll(
    page = 1,
    limit = 20,
    search?: string,
    role?: 'CUSTOMER' | 'ADMIN' | 'SUPERVISOR' | 'STAFF',
    paymentMethod?: string,
    customerGroupId?: string
  ) {
    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (customerGroupId) where.customerGroupId = customerGroupId;
    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }
    if (paymentMethod) {
      where.orders = { some: { paymentMethod } };
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          accessRoleId: true,
          accessRole: { select: { id: true, name: true, permissions: true } },
          isActive: true,
          customerGroupId: true,
          customerGroup: { select: { id: true, name: true } },
          createdAt: true,
          addresses: {
            orderBy: { isDefault: 'desc' },
            take: 1,
            select: { address: true },
          },
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const ids = customers.map((c) => c.id);
    const spends = ids.length
      ? await prisma.order.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, status: { not: 'CANCELLED' } },
          _sum: { totalPrice: true },
        })
      : [];
    const spendMap = new Map(spends.map((s) => [s.userId, Number(s._sum.totalPrice ?? 0)]));

    const lastOrders = ids.length
      ? await prisma.order.findMany({
          where: { userId: { in: ids } },
          orderBy: { createdAt: 'desc' },
          select: { userId: true, createdAt: true, deliveryAddress: true, paymentMethod: true },
          take: 400,
        })
      : [];
    const lastOrderMap = new Map<string, (typeof lastOrders)[number]>();
    for (const order of lastOrders) {
      if (order.userId && !lastOrderMap.has(order.userId)) {
        lastOrderMap.set(order.userId, order);
      }
    }

    return {
      customers: customers.map((customer) => {
        const last = lastOrderMap.get(customer.id);
        return {
          ...customer,
          address: customer.addresses[0]?.address || last?.deliveryAddress || null,
          totalSpend: spendMap.get(customer.id) ?? 0,
          lastOrderAt: last?.createdAt ?? null,
          lastPaymentMethod: last?.paymentMethod ?? null,
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(data: {
    phone: string;
    firstName?: string;
    lastName?: string;
    customerGroupId?: string;
  }) {
    const phone = normalizePhone(data.phone);

    return prisma.user.create({
      data: {
        phone,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'CUSTOMER',
        customerGroupId: data.customerGroupId,
      },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        customerGroupId: true,
        createdAt: true,
      },
    });
  }

  async assignGroup(userId: string, customerGroupId: string | null) {
    if (customerGroupId) {
      const group = await prisma.customerGroup.findUnique({ where: { id: customerGroupId } });
      if (!group) throw new AppError(404, 'گروه مشتری یافت نشد');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { customerGroupId },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        customerGroupId: true,
        customerGroup: { select: { id: true, name: true } },
      },
    });
  }

  async exportPhonesCsv(options?: { customerGroupId?: string; paymentMethod?: string }) {
    const where: Record<string, unknown> = { role: 'CUSTOMER', isActive: true };
    if (options?.customerGroupId) where.customerGroupId = options.customerGroupId;
    if (options?.paymentMethod) where.orders = { some: { paymentMethod: options.paymentMethod } };

    const users = await prisma.user.findMany({
      where,
      select: { phone: true, firstName: true, lastName: true },
      orderBy: { createdAt: 'asc' },
    });

    const header = 'phone,firstName,lastName';
    const rows = users.map(
      (u) =>
        `${u.phone},"${(u.firstName ?? '').replace(/"/g, '""')}","${(u.lastName ?? '').replace(/"/g, '""')}"`
    );

    return [header, ...rows].join('\n');
  }

  async broadcastSms(
    message: string,
    options?: { customerGroupId?: string; paymentMethod?: string }
  ) {
    if (!message?.trim()) throw new AppError(400, 'متن پیام الزامی است');

    const where: Record<string, unknown> = { role: 'CUSTOMER', isActive: true };
    if (options?.customerGroupId) where.customerGroupId = options.customerGroupId;
    if (options?.paymentMethod) where.orders = { some: { paymentMethod: options.paymentMethod } };

    const users = await prisma.user.findMany({
      where,
      select: { phone: true },
    });

    const recipients = users.map((u) => u.phone);
    return smsService.broadcast(recipients, message.trim());
  }

  async getById(id: string) {
    const customer = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        customerGroupId: true,
        customerGroup: { select: { id: true, name: true } },
        createdAt: true,
        addresses: true,
        orders: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { orders: true } },
      },
    });
    if (!customer) throw new AppError(404, 'کاربر یافت نشد');

    const spend = await prisma.order.aggregate({
      where: { userId: id, status: { not: 'CANCELLED' } },
      _sum: { totalPrice: true },
    });

    return {
      ...customer,
      totalSpend: Number(spend._sum.totalPrice ?? 0),
    };
  }

  async getFrequentCustomers(limit = 10) {
    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        _count: { select: { orders: true } },
      },
      orderBy: { orders: { _count: 'desc' } },
      take: limit,
    });
    return customers.filter((c: { _count: { orders: number } }) => c._count.orders > 0);
  }
}

export class AdminUserService {
  async updateRole(
    userId: string,
    payload: { role: 'CUSTOMER' | 'ADMIN' | 'SUPERVISOR' | 'STAFF'; accessRoleId?: string | null },
    actorId: string
  ) {
    const role = payload.role;
    if (userId === actorId && role !== 'ADMIN') {
      throw new AppError(400, 'نمی‌توانید نقش خودتان را تغییر دهید');
    }

    const allowed: Array<'CUSTOMER' | 'ADMIN' | 'SUPERVISOR' | 'STAFF'> = [
      'CUSTOMER',
      'ADMIN',
      'SUPERVISOR',
      'STAFF',
    ];
    if (!allowed.includes(role)) {
      throw new AppError(400, 'نقش نامعتبر است');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'کاربر یافت نشد');

    if (user.role === 'ADMIN' && role !== 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (adminCount <= 1) {
        throw new AppError(400, 'حداقل یک مدیر باید در سیستم باقی بماند');
      }
    }

    let accessRoleId: string | null = null;
    let finalRole = role;
    if (payload.accessRoleId) {
      const custom = await prisma.accessRole.findUnique({ where: { id: payload.accessRoleId } });
      if (!custom) throw new AppError(400, 'نقش سفارشی یافت نشد');
      accessRoleId = custom.id;
      finalRole = 'STAFF';
    }

    return prisma.user.update({
      where: { id: userId },
      data: { role: finalRole, accessRoleId },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        accessRoleId: true,
        accessRole: { select: { id: true, name: true, permissions: true } },
        isActive: true,
        createdAt: true,
      },
    });
  }

  async createAdmin(data: {
    phone: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    role?: 'ADMIN' | 'SUPERVISOR' | 'STAFF';
    accessRoleId?: string | null;
  }) {
    const phone = normalizePhone(data.phone);
    let role = data.role ?? 'ADMIN';
    let accessRoleId: string | null = null;
    if (data.accessRoleId) {
      const custom = await prisma.accessRole.findUnique({ where: { id: data.accessRoleId } });
      if (!custom) throw new AppError(400, 'نقش سفارشی یافت نشد');
      accessRoleId = custom.id;
      role = 'STAFF';
    }
    const passwordHash = data.password
      ? await (await import('bcryptjs')).default.hash(data.password, 10)
      : undefined;

    const user = await prisma.user.upsert({
      where: { phone },
      update: {
        role,
        accessRoleId,
        firstName: data.firstName ?? undefined,
        lastName: data.lastName ?? undefined,
        isActive: true,
        ...(passwordHash ? { passwordHash } : {}),
      },
      create: {
        phone,
        role,
        accessRoleId,
        firstName: data.firstName ?? 'کاربر',
        lastName: data.lastName ?? 'پنل',
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        accessRoleId: true,
        accessRole: { select: { id: true, name: true, permissions: true } },
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  async toggleActive(userId: string, actorId: string) {
    if (userId === actorId) {
      throw new AppError(400, 'نمی‌توانید حساب خودتان را غیرفعال کنید');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'کاربر یافت نشد');

    if (user.role === 'ADMIN' && user.isActive) {
      const activeAdmins = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true },
      });
      if (activeAdmins <= 1) {
        throw new AppError(400, 'حداقل یک ادمین فعال باید در سیستم باقی بماند');
      }
    }

    return prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }
}

export class DiscountService {
  async getAll(includeInactive = false) {
    return prisma.discount.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: { product: { select: { id: true, name: true, price: true, image: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    productId: string;
    percentage?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new AppError(404, 'محصول یافت نشد');

    let discountPrice: number | null = product.discountPrice ? Number(product.discountPrice) : null;
    if (data.percentage) {
      const price = Number(product.price);
      discountPrice = Math.round(price * (1 - data.percentage / 100));
      await prisma.product.update({
        where: { id: data.productId },
        data: { discountPrice },
      });
    }

    return prisma.discount.create({ data, include: { product: true } });
  }

  async update(id: string, data: { percentage?: number; startDate?: Date; endDate?: Date; isActive?: boolean }) {
    const discount = await prisma.discount.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!discount) throw new AppError(404, 'تخفیف یافت نشد');

    if (data.percentage !== undefined) {
      const price = Number(discount.product.price);
      const discountPrice = Math.round(price * (1 - data.percentage / 100));
      await prisma.product.update({
        where: { id: discount.productId },
        data: { discountPrice },
      });
    }

    return prisma.discount.update({ where: { id }, data, include: { product: true } });
  }

  async delete(id: string) {
    const discount = await prisma.discount.findUnique({ where: { id } });
    if (!discount) throw new AppError(404, 'تخفیف یافت نشد');
    await prisma.discount.update({ where: { id }, data: { isActive: false } });
  }
}

export class CustomerGroupService {
  async getAll() {
    return prisma.customerGroup.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
  }

  async create(data: { name: string; description?: string }) {
    return prisma.customerGroup.create({ data });
  }

  async update(id: string, data: { name?: string; description?: string | null }) {
    return prisma.customerGroup.update({ where: { id }, data });
  }

  async delete(id: string) {
    await prisma.user.updateMany({ where: { customerGroupId: id }, data: { customerGroupId: null } });
    await prisma.customerGroup.delete({ where: { id } });
  }
}

export const addressService = new AddressService();
export const customerService = new CustomerService();
export const customerGroupService = new CustomerGroupService();
export const adminUserService = new AdminUserService();
export const discountService = new DiscountService();
