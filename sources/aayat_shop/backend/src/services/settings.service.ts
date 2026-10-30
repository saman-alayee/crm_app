import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { config } from '../config';
import { SITE_NAME } from '../config/site';
import { AppError } from '../utils/errors';
import { normalizePhone } from '../utils/normalize';

export const NEW_ORDER_SMS_KEY = 'new_order_sms';
export const MAINTENANCE_KEY = 'maintenance';
export const ANNOUNCEMENT_KEY = 'announcement';
export const DEFAULT_ANNOUNCEMENT_TEXT = 'زمان ارسال یک هفته کاری';
export const SHIPPING_SETTINGS_KEY = 'shipping';
export const DEFAULT_NATIONWIDE_SHIPPING_FEE = 0;
export const DEFAULT_NATIONWIDE_SHIPPING_HINT =
  'پرداخت هزینه پست در محل (هنگام تحویل) انجام می‌شود';
export const DEFAULT_CART_HOLD_MINUTES = 30;

export interface ShippingSettings {
  /** Fee charged at online checkout for nationwide shipping (toman). */
  nationwideFee: number;
  /** Storefront hint under «هزینه ارسال». */
  nationwideHint: string;
  /** Unpaid cart items are removed after this many minutes. */
  cartHoldMinutes: number;
}

export const DEFAULT_NEW_ORDER_SMS_TEMPLATE =
  `سفارش جدید {orderNumber}\nمشتری: {customerName}\n${SITE_NAME}`;

export interface NewOrderSmsSettings {
  /** When false, no operator SMS is sent on new orders. */
  enabled: boolean;
  /** Explicit recipient phones (09xxxxxxxxx). */
  phones: string[];
  /** Also SMS active ADMIN / SUPERVISOR / STAFF accounts. */
  includePanelStaff: boolean;
  /** Placeholders: {orderNumber} {customerName} */
  messageTemplate: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePhones(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const phones: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim()) continue;
    try {
      phones.push(normalizePhone(item.trim()));
    } catch {
      // skip invalid
    }
  }
  return [...new Set(phones)];
}

function normalizeSettings(raw: unknown): NewOrderSmsSettings {
  const data = isRecord(raw) ? raw : {};
  const template =
    typeof data.messageTemplate === 'string' && data.messageTemplate.trim()
      ? data.messageTemplate.trim()
      : DEFAULT_NEW_ORDER_SMS_TEMPLATE;

  return {
    enabled: data.enabled !== false,
    phones: parsePhones(data.phones),
    includePanelStaff: data.includePanelStaff === true,
    messageTemplate: template,
  };
}

export interface MaintenanceSettings {
  enabled: boolean;
  message: string;
}

const DEFAULT_MAINTENANCE_MESSAGE =
  'آتلیه در حال دوخت و پرداخت است. چند لحظه دیگر برمی‌گردیم.';

function normalizeMaintenance(raw: unknown): MaintenanceSettings {
  const data = isRecord(raw) ? raw : {};
  const message =
    typeof data.message === 'string' && data.message.trim()
      ? data.message.trim().slice(0, 280)
      : DEFAULT_MAINTENANCE_MESSAGE;
  return {
    enabled: data.enabled === true,
    message,
  };
}

function defaultSettings(): NewOrderSmsSettings {
  return {
    enabled: true,
    phones: [...config.adminPhones],
    includePanelStaff: false,
    messageTemplate: DEFAULT_NEW_ORDER_SMS_TEMPLATE,
  };
}

export class SettingsService {
  async getNewOrderSms(): Promise<NewOrderSmsSettings> {
    const row = await prisma.appSetting.findUnique({ where: { key: NEW_ORDER_SMS_KEY } });
    if (!row) return defaultSettings();
    return normalizeSettings(row.value);
  }

  async updateNewOrderSms(input: Partial<NewOrderSmsSettings>): Promise<NewOrderSmsSettings> {
    const current = await this.getNewOrderSms();

    let phones = current.phones;
    if (input.phones !== undefined) {
      phones = [];
      for (const phone of input.phones) {
        try {
          phones.push(normalizePhone(String(phone).trim()));
        } catch {
          throw new AppError(400, `شماره نامعتبر: ${phone}`);
        }
      }
      phones = [...new Set(phones)];
    }

    const next: NewOrderSmsSettings = {
      enabled: input.enabled ?? current.enabled,
      phones,
      includePanelStaff: input.includePanelStaff ?? current.includePanelStaff,
      messageTemplate:
        typeof input.messageTemplate === 'string' && input.messageTemplate.trim()
          ? input.messageTemplate.trim()
          : current.messageTemplate,
    };

    if (next.enabled && !next.phones.length && !next.includePanelStaff) {
      throw new AppError(400, 'حداقل یک شماره گیرنده یا ارسال به پرسنل پنل را فعال کنید');
    }

    await prisma.appSetting.upsert({
      where: { key: NEW_ORDER_SMS_KEY },
      create: { key: NEW_ORDER_SMS_KEY, value: next as unknown as Prisma.InputJsonValue },
      update: { value: next as unknown as Prisma.InputJsonValue },
    });

    return next;
  }

  async resolveNewOrderSmsRecipients(): Promise<{
    enabled: boolean;
    phones: string[];
    messageTemplate: string;
  }> {
    const settings = await this.getNewOrderSms();
    if (!settings.enabled) {
      return { enabled: false, phones: [], messageTemplate: settings.messageTemplate };
    }

    const phones = [...settings.phones];

    if (settings.includePanelStaff) {
      const staff = await prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'SUPERVISOR', 'STAFF'] },
          isActive: true,
        },
        select: { phone: true },
      });
      for (const u of staff) phones.push(u.phone);
    }

    return {
      enabled: true,
      phones: [...new Set(phones)],
      messageTemplate: settings.messageTemplate,
    };
  }

  async sendNewOrderSmsTest(input: {
    phone: string;
    messageTemplate?: string;
  }): Promise<{ phone: string; preview: string; stub: boolean }> {
    let phone: string;
    try {
      phone = normalizePhone(String(input.phone).trim());
    } catch {
      throw new AppError(400, 'شماره موبایل نامعتبر است');
    }

    const settings = await this.getNewOrderSms();
    const template =
      typeof input.messageTemplate === 'string' && input.messageTemplate.trim()
        ? input.messageTemplate.trim()
        : settings.messageTemplate;

    const preview = `[تست] ${template
      .split('{orderNumber}')
      .join('KK-TEST-001')
      .split('{customerName}')
      .join('مشتری تست')}`;

    const { smsService } = await import('./sms.service');
    const stub = !smsService.isConfigured();
    await smsService.broadcast([phone], preview);

    return { phone, preview, stub };
  }

  async getMaintenance(): Promise<MaintenanceSettings> {
    const row = await prisma.appSetting.findUnique({ where: { key: MAINTENANCE_KEY } });
    if (!row) return { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE };
    return normalizeMaintenance(row.value);
  }

  async updateMaintenance(input: Partial<MaintenanceSettings>): Promise<MaintenanceSettings> {
    const current = await this.getMaintenance();
    const next: MaintenanceSettings = {
      enabled: input.enabled ?? current.enabled,
      message:
        typeof input.message === 'string' && input.message.trim()
          ? input.message.trim().slice(0, 280)
          : current.message,
    };

    await prisma.appSetting.upsert({
      where: { key: MAINTENANCE_KEY },
      create: { key: MAINTENANCE_KEY, value: next as unknown as Prisma.InputJsonValue },
      update: { value: next as unknown as Prisma.InputJsonValue },
    });

    return next;
  }

  async getAnnouncement(): Promise<{ text: string }> {
    const row = await prisma.appSetting.findUnique({ where: { key: ANNOUNCEMENT_KEY } });
    if (!row || !isRecord(row.value) || typeof row.value.text !== 'string') {
      return { text: DEFAULT_ANNOUNCEMENT_TEXT };
    }
    return { text: row.value.text.trim().slice(0, 180) };
  }

  async updateAnnouncement(text: string): Promise<{ text: string }> {
    const next = { text: text.trim().slice(0, 180) };
    await prisma.appSetting.upsert({
      where: { key: ANNOUNCEMENT_KEY },
      create: { key: ANNOUNCEMENT_KEY, value: next },
      update: { value: next },
    });
    return next;
  }

  async getShipping(): Promise<ShippingSettings> {
    const row = await prisma.appSetting.findUnique({ where: { key: SHIPPING_SETTINGS_KEY } });
    return this.normalizeShipping(row?.value);
  }

  async updateShipping(input: Partial<ShippingSettings>): Promise<ShippingSettings> {
    const current = await this.getShipping();
    const next = this.normalizeShipping({
      nationwideFee: input.nationwideFee ?? current.nationwideFee,
      nationwideHint: input.nationwideHint ?? current.nationwideHint,
      cartHoldMinutes: input.cartHoldMinutes ?? current.cartHoldMinutes,
    });

    await prisma.appSetting.upsert({
      where: { key: SHIPPING_SETTINGS_KEY },
      create: { key: SHIPPING_SETTINGS_KEY, value: next as unknown as Prisma.InputJsonValue },
      update: { value: next as unknown as Prisma.InputJsonValue },
    });

    return next;
  }

  private normalizeShipping(raw: unknown): ShippingSettings {
    const data = isRecord(raw) ? raw : {};
    const feeRaw = data.nationwideFee;
    const fee =
      typeof feeRaw === 'number'
        ? feeRaw
        : typeof feeRaw === 'string' && feeRaw.trim()
          ? Number(feeRaw)
          : DEFAULT_NATIONWIDE_SHIPPING_FEE;
    const nationwideFee = Number.isFinite(fee)
      ? Math.max(0, Math.min(10_000_000, Math.round(fee)))
      : DEFAULT_NATIONWIDE_SHIPPING_FEE;
    const hint =
      typeof data.nationwideHint === 'string' && data.nationwideHint.trim()
        ? data.nationwideHint.trim().slice(0, 200)
        : DEFAULT_NATIONWIDE_SHIPPING_HINT;
    const minutesRaw = data.cartHoldMinutes;
    const minutes =
      typeof minutesRaw === 'number'
        ? minutesRaw
        : typeof minutesRaw === 'string' && minutesRaw.trim()
          ? Number(minutesRaw)
          : DEFAULT_CART_HOLD_MINUTES;
    const cartHoldMinutes = Number.isFinite(minutes)
      ? Math.max(5, Math.min(24 * 60, Math.round(minutes)))
      : DEFAULT_CART_HOLD_MINUTES;
    return { nationwideFee, nationwideHint: hint, cartHoldMinutes };
  }
}

export const settingsService = new SettingsService();
