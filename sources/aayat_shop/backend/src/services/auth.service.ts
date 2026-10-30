import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { config } from '../config';
import {
  generateOtpCode,
  generatePasswordResetToken,
  generateToken,
  isPanelRole,
  verifyPasswordResetToken,
  type UserRole,
} from '../utils/helpers';
import { passwordPolicyError } from '../utils/password';
import { AppError } from '../utils/errors';
import { normalizeDigits, normalizePhone } from '../utils/normalize';
import { smsService } from './sms.service';
import { permissionsForRole } from '../utils/permissions';

export type { UserRole };

export class AuthService {
  async sendOtp(phone: string) {
    const normalizedPhone = this.normalizePhone(phone);

    const code = config.otp.devMode ? '123456' : generateOtpCode();
    const expiresAt = new Date(Date.now() + config.otp.expiresMinutes * 60 * 1000);

    if (config.otp.devMode) {
      // Local/dev only — never return the code to the client.
      console.log(`OTP for ${normalizedPhone}: ${code}`);
    } else {
      await smsService.sendOtp(normalizedPhone, code);
    }

    await prisma.otpCode.create({
      data: { phone: normalizedPhone, code, expiresAt },
    });

    return { message: 'کد تأیید ارسال شد' };
  }

  async startAuth(phone: string, intent?: 'otp' | 'forgot') {
    const normalizedPhone = this.normalizePhone(phone);
    const user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true, passwordHash: true, isActive: true },
    });

    if (user && !user.isActive) {
      throw new AppError(403, 'حساب کاربری غیرفعال است');
    }

    // Customer storefront login is phone + OTP only (no username/email/password step).
    if (intent === 'forgot') {
      if (!user) throw new AppError(400, 'حسابی با این شماره یافت نشد');
      await this.sendOtp(normalizedPhone);
      return {
        step: 'forgotPassword' as const,
        hasPassword: true,
        message: `کد تایید به شماره ${normalizedPhone} پیامک شد`,
      };
    }

    await this.sendOtp(normalizedPhone);
    return {
      step: user ? ('loginByOtp' as const) : ('signIn' as const),
      hasPassword: Boolean(user?.passwordHash),
      message: `کد تایید به شماره ${normalizedPhone} پیامک شد`,
    };
  }

  async verifyForgotOtp(phone: string, code: string) {
    const normalizedPhone = this.normalizePhone(phone);
    await this.consumeValidOtp(normalizedPhone, code);
    const user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (!user || !user.isActive) {
      throw new AppError(400, 'حسابی با این شماره یافت نشد');
    }
    return { resetToken: generatePasswordResetToken(user.id, normalizedPhone) };
  }

  async resetPassword(resetToken: string, password: string) {
    const policyError = passwordPolicyError(password || '');
    if (policyError) throw new AppError(400, policyError);

    let reset: { userId: string };
    try {
      reset = verifyPasswordResetToken(resetToken);
    } catch {
      throw new AppError(400, 'درخواست منقضی شده است. دوباره کد تایید بگیرید');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash },
    });

    return await this.buildAuthResponse(user);
  }

  async verifyOtp(phone: string, code: string, options?: { requireAdmin?: boolean }) {
    const normalizedPhone = this.normalizePhone(phone);
    const normalizedCode = normalizeDigits(code).trim();

    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        phone: normalizedPhone,
        code: normalizedCode,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new AppError(400, 'کد تأیید نامعتبر یا منقضی شده است');
    }

    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    const user = await this.findOrCreateUser(normalizedPhone);

    if (!user.isActive) {
      throw new AppError(403, 'حساب کاربری غیرفعال است');
    }

    if (options?.requireAdmin && !isPanelRole(user.role)) {
      throw new AppError(403, 'این صفحه مخصوص ورود مدیران است');
    }

    return await this.buildAuthResponse(user);
  }

  /** Customer (or any user with personal password) login */
  async loginWithPassword(phone: string, password: string, options?: { requireAdmin?: boolean }) {
    const normalizedPhone = this.normalizePhone(phone);
    let user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });

    // Bootstrap listed admin phones (same as OTP login) so password login works after DB reset
    if (!user && config.adminPhones.includes(normalizedPhone)) {
      user = await this.findOrCreateUser(normalizedPhone);
    }

    if (!user || !user.isActive) {
      throw new AppError(401, 'شماره موبایل یا رمز عبور اشتباه است');
    }

    if (options?.requireAdmin && !isPanelRole(user.role)) {
      throw new AppError(403, 'این صفحه مخصوص ورود مدیران است');
    }

    const ok = await this.verifyUserPassword(user, password);
    if (!ok) {
      throw new AppError(401, 'شماره موبایل یا رمز عبور اشتباه است');
    }

    return await this.buildAuthResponse(user);
  }

  async setPassword(
    userId: string,
    data: { password: string; currentPassword?: string; otpCode?: string }
  ) {
    const policyError = passwordPolicyError(data.password || '');
    if (policyError) {
      throw new AppError(400, policyError);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'کاربر یافت نشد');

    const otpVerified = data.otpCode
      ? await this.consumeValidOtp(user.phone, data.otpCode)
      : false;

    if (user.passwordHash && !otpVerified) {
      if (!data.currentPassword) {
        throw new AppError(400, 'رمز عبور فعلی الزامی است');
      }
      const match = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!match) {
        throw new AppError(400, 'رمز عبور فعلی اشتباه است');
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return {
      hasPassword: true,
      message: user.passwordHash ? 'رمز عبور تغییر کرد' : 'رمز عبور ذخیره شد',
    };
  }

  async confirmOtp(phone: string, code: string) {
    const normalizedPhone = this.normalizePhone(phone);
    await this.consumeValidOtp(normalizedPhone, code);
    return { verified: true, phone: normalizedPhone };
  }

  /** Validates and consumes OTP for checkout (e.g. Social Security payment). */
  async verifyCheckoutOtp(phone: string, code: string) {
    const normalizedPhone = this.normalizePhone(phone);
    await this.consumeValidOtp(normalizedPhone, code);
    return { verified: true, phone: normalizedPhone };
  }

  private async consumeValidOtp(phone: string, code: string): Promise<boolean> {
    const normalizedCode = normalizeDigits(code).trim();
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        phone,
        code: normalizedCode,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new AppError(400, 'کد تأیید نامعتبر یا منقضی شده است');
    }

    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    return true;
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        accessRoleId: true,
        accessRole: { select: { id: true, name: true, permissions: true } },
        passwordHash: true,
        createdAt: true,
        addresses: { orderBy: { isDefault: 'desc' } },
        _count: { select: { orders: true } },
      },
    });

    if (!user) throw new AppError(404, 'کاربر یافت نشد');

    const { passwordHash, accessRole, ...rest } = user;
    const permissions = permissionsForRole(
      user.role,
      user.accessRoleId ? accessRole?.permissions : undefined
    );
    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role as UserRole,
    });

    return {
      ...rest,
      accessRole,
      permissions,
      hasPassword: Boolean(passwordHash),
      token,
    };
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        passwordHash: true,
      },
    }).then(({ passwordHash, ...rest }) => ({
      ...rest,
      hasPassword: Boolean(passwordHash),
    }));
  }

  private async verifyUserPassword(
    user: { passwordHash: string | null; role: UserRole },
    password: string
  ): Promise<boolean> {
    if (user.passwordHash) {
      return bcrypt.compare(password, user.passwordHash);
    }

    // Legacy fallback: shared ADMIN_PASSWORD for any panel role without personal hash
    if (isPanelRole(user.role) && password === config.adminPassword) {
      return true;
    }

    return false;
  }

  private async findOrCreateUser(phone: string) {
    let user = await prisma.user.findUnique({ where: { phone } });
    const isAdminPhone = config.adminPhones.includes(phone);

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          role: isAdminPhone ? 'ADMIN' : 'CUSTOMER',
          firstName: isAdminPhone ? 'مدیر' : undefined,
          lastName: isAdminPhone ? 'سیستم' : undefined,
        },
      });
      return user;
    }

    // Only bootstrap CUSTOMER → ADMIN for listed phones.
    // Never overwrite SUPERVISOR / STAFF (manual role assignment must stick).
    if (isAdminPhone && user.role === 'CUSTOMER') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
    }

    return user;
  }

  private async buildAuthResponse(user: {
    id: string;
    phone: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
    passwordHash?: string | null;
    accessRoleId?: string | null;
  }) {
    let customPermissions: unknown;
    if (user.accessRoleId) {
      const accessRole = await prisma.accessRole.findUnique({
        where: { id: user.accessRoleId },
        select: { id: true, name: true, permissions: true },
      });
      customPermissions = accessRole?.permissions;
    }

    const permissions = permissionsForRole(
      user.role,
      user.accessRoleId ? customPermissions : undefined
    );

    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role as UserRole,
    });

    return {
      token,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        accessRoleId: user.accessRoleId ?? null,
        permissions,
        hasPassword: Boolean(user.passwordHash),
      },
    };
  }

  private normalizePhone(phone: string): string {
    try {
      return normalizePhone(phone);
    } catch {
      throw new AppError(400, 'شماره موبایل نامعتبر است');
    }
  }
}

export const authService = new AuthService();
