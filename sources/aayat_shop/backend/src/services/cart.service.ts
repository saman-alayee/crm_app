import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';
import { settingsService } from './settings.service';

export class CartService {
  private async resolveUserId(userId?: string): Promise<string | undefined> {
    if (!userId) return undefined;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return user ? userId : undefined;
  }

  private async getOrCreateCart(userId?: string, sessionId?: string) {
    const validUserId = await this.resolveUserId(userId);

    if (validUserId) {
      let cart = await prisma.cart.findUnique({
        where: { userId: validUserId },
        include: { items: { include: { product: true } } },
      });
      if (!cart) {
        cart = await prisma.cart.create({
          data: { userId: validUserId },
          include: { items: { include: { product: true } } },
        });
      }
      return cart;
    }

    if (sessionId) {
      let cart = await prisma.cart.findUnique({
        where: { sessionId },
        include: { items: { include: { product: true } } },
      });
      if (!cart) {
        cart = await prisma.cart.create({
          data: { sessionId },
          include: { items: { include: { product: true } } },
        });
      }
      return cart;
    }

    const newSessionId = uuidv4();
    const cart = await prisma.cart.create({
      data: { sessionId: newSessionId },
      include: { items: { include: { product: true } } },
    });
    return { ...cart, newSessionId };
  }

  async getCart(userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const holdMinutes = await this.expireStaleItems(cart.id);
    const fresh = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { product: true } } },
    });
    const formatted = this.formatCart(fresh!, holdMinutes);
    if ('newSessionId' in cart) {
      (formatted as typeof formatted & { sessionId: string }).sessionId = cart.newSessionId;
    }
    return formatted;
  }

  private async expireStaleItems(cartId: string) {
    const { cartHoldMinutes } = await settingsService.getShipping();
    const cutoff = new Date(Date.now() - cartHoldMinutes * 60 * 1000);
    await prisma.cartItem.deleteMany({
      where: { cartId, updatedAt: { lt: cutoff } },
    });
    return cartHoldMinutes;
  }

  async addItem(userId: string | undefined, sessionId: string | undefined, productId: string, quantity = 1) {
    const product = await prisma.product.findUnique({ where: { id: productId, isActive: true } });
    if (!product) throw new AppError(404, 'محصول یافت نشد');
    if (product.stock < quantity) throw new AppError(400, 'موجودی کافی نیست');

    const cart = await this.getOrCreateCart(userId, sessionId);
    await this.expireStaleItems(cart.id);
    const cartId = cart.id;

    const existingItem = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (newQty > product.stock) throw new AppError(400, 'موجودی کافی نیست');
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      await prisma.cartItem.create({
        data: { cartId, productId, quantity },
      });
    }

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } },
    });

    const holdMinutes = (await settingsService.getShipping()).cartHoldMinutes;
    const result = this.formatCart(updatedCart!, holdMinutes);
    if ('newSessionId' in cart) {
      (result as typeof result & { sessionId: string }).sessionId = cart.newSessionId;
    }
    return result;
  }

  async updateItem(userId: string | undefined, sessionId: string | undefined, productId: string, quantity: number) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    if (quantity <= 0) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    } else {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) throw new AppError(404, 'محصول یافت نشد');
      if (quantity > product.stock) throw new AppError(400, 'موجودی کافی نیست');

      await prisma.cartItem.updateMany({
        where: { cartId: cart.id, productId },
        data: { quantity },
      });
    }

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { product: true } } },
    });

    const holdMinutes = (await settingsService.getShipping()).cartHoldMinutes;
    return this.formatCart(updatedCart!, holdMinutes);
  }

  async removeItem(userId: string | undefined, sessionId: string | undefined, productId: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { product: true } } },
    });

    return this.formatCart(updatedCart!);
  }

  async clearCart(userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.formatCart({ ...cart, items: [] });
  }

  async mergeCarts(userId: string, sessionId: string) {
    const sessionCart = await prisma.cart.findUnique({
      where: { sessionId },
      include: { items: true },
    });

    if (!sessionCart || sessionCart.items.length === 0) return;

    const userCart = await this.getOrCreateCart(userId);

    for (const item of sessionCart.items) {
      const existing = await prisma.cartItem.findUnique({
        where: { cartId_productId: { cartId: userCart.id, productId: item.productId } },
      });

      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + item.quantity },
        });
      } else {
        await prisma.cartItem.create({
          data: { cartId: userCart.id, productId: item.productId, quantity: item.quantity },
        });
      }
    }

    await prisma.cart.delete({ where: { id: sessionCart.id } });
  }

  private formatCart(cart: {
    id: string;
    items: Array<{
      id: string;
      quantity: number;
      updatedAt?: Date;
      product: {
        id: string;
        name: string;
        slug: string;
        price: { toNumber?: () => number } | number | bigint;
        discountPrice: { toNumber?: () => number } | number | bigint | null;
        stock: number;
        image: string | null;
        unit: string | null;
        isActive: boolean;
      };
    }>;
  }, holdMinutes = 30) {
    const items = cart.items
      .filter((item) => item.product.isActive)
      .map((item) => {
        const price = Number(item.product.price);
        const discountPrice = item.product.discountPrice ? Number(item.product.discountPrice) : null;
        const effectivePrice = discountPrice ?? price;

        return {
          id: item.id,
          productId: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          image: item.product.image,
          unit: item.product.unit,
          quantity: item.quantity,
          price,
          discountPrice,
          effectivePrice,
          subtotal: effectivePrice * item.quantity,
          stock: item.product.stock,
        };
      });

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.subtotal, 0);
    const touched = cart.items
      .map((item) => item.updatedAt)
      .filter((value): value is Date => value instanceof Date);
    const expiresAt =
      touched.length > 0
        ? new Date(Math.min(...touched.map((value) => value.getTime())) + holdMinutes * 60 * 1000).toISOString()
        : null;

    return {
      id: cart.id,
      items,
      totalItems,
      totalPrice,
      holdMinutes,
      expiresAt,
    };
  }
}

export const cartService = new CartService();
