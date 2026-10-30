export type FieldErrors = Record<string, string>;

export type RuleFn = (value: unknown, all?: Record<string, unknown>) => string | null;

export const rules = {
  required(message = 'این فیلد الزامی است'): RuleFn {
    return (value) => {
      if (value == null) return message;
      if (typeof value === 'string' && !value.trim()) return message;
      if (typeof value === 'number' && Number.isNaN(value)) return message;
      return null;
    };
  },
  minLength(min: number, message?: string): RuleFn {
    return (value) => {
      const s = String(value ?? '');
      if (!s) return null;
      return s.length < min ? message || `حداقل ${min} کاراکتر` : null;
    };
  },
  maxLength(max: number, message?: string): RuleFn {
    return (value) => {
      const s = String(value ?? '');
      if (s.length > max) return message || `حداکثر ${max} کاراکتر`;
      return null;
    };
  },
  username(message = 'نام کاربری باید انگلیسی، عدد یا _ باشد (۳ تا ۳۲ کاراکتر)'): RuleFn {
    return (value) => {
      const s = String(value ?? '').trim();
      if (!s) return null;
      return /^[a-zA-Z][a-zA-Z0-9._-]{2,31}$/.test(s) ? null : message;
    };
  },
  phone(message = 'شماره موبایل معتبر نیست (مثال: 09123456789)'): RuleFn {
    return (value) => {
      const s = String(value ?? '').trim().replace(/\s|-/g, '');
      if (!s) return null;
      return /^09\d{9}$/.test(s) ? null : message;
    };
  },
  password(message = 'رمز عبور حداقل ۶ کاراکتر باشد'): RuleFn {
    return (value) => {
      const s = String(value ?? '');
      if (!s) return null;
      return s.length >= 6 ? null : message;
    };
  },
  positiveNumber(message = 'مبلغ باید بیشتر از صفر باشد'): RuleFn {
    return (value) => {
      const n = Number(value);
      if (value === '' || value == null) return null;
      return Number.isFinite(n) && n > 0 ? null : message;
    };
  },
  iban(message = 'شبا باید با IR و ۲۴ رقم باشد'): RuleFn {
    return (value) => {
      const s = String(value ?? '').trim().replace(/\s/g, '').toUpperCase();
      if (!s) return null;
      return /^IR\d{24}$/.test(s) ? null : message;
    };
  },
  time(message = 'ساعت معتبر نیست'): RuleFn {
    return (value) => {
      const s = String(value ?? '').trim();
      if (!s) return null;
      return /^\d{2}:\d{2}$/.test(s) ? null : message;
    };
  },
  dateIso(message = 'تاریخ را انتخاب کنید'): RuleFn {
    return (value) => {
      const s = String(value ?? '').trim();
      if (!s) return null;
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? null : message;
    };
  },
  endAfterStart(startKey: string, message = 'ساعت پایان باید بعد از شروع باشد'): RuleFn {
    return (value, all) => {
      const end = String(value ?? '');
      const start = String(all?.[startKey] ?? '');
      if (!end || !start) return null;
      return end > start ? null : message;
    };
  },
};

export function useFormValidation() {
  const errors = reactive<FieldErrors>({});

  function clearErrors() {
    for (const key of Object.keys(errors)) delete errors[key];
  }

  function setError(field: string, message: string) {
    errors[field] = message;
  }

  function clearField(field: string) {
    delete errors[field];
  }

  function validate(
    data: Record<string, unknown>,
    schema: Record<string, RuleFn[]>
  ): boolean {
    clearErrors();
    let ok = true;
    for (const [field, fieldRules] of Object.entries(schema)) {
      for (const rule of fieldRules) {
        const msg = rule(data[field], data);
        if (msg) {
          errors[field] = msg;
          ok = false;
          break;
        }
      }
    }
    return ok;
  }

  return { errors, clearErrors, clearField, setError, validate };
}
