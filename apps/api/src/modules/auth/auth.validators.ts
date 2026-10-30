import { z } from 'zod';

export const loginSchema = z.object({
  username: z
    .string({ required_error: 'نام کاربری را وارد کنید' })
    .trim()
    .min(2, 'نام کاربری باید حداقل ۲ کاراکتر باشد'),
  password: z
    .string({ required_error: 'رمز عبور را وارد کنید' })
    .min(1, 'رمز عبور را وارد کنید'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
