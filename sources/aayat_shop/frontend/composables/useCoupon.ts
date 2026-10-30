export interface AppliedCoupon {
  couponId: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  discountAmount: number;
  subtotal: number;
  totalPrice: number;
}

export function useCoupon() {
  const api = useApi();
  const applied = useState<AppliedCoupon | null>('applied-coupon', () => null);
  const code = ref('');
  const applying = ref(false);
  const error = ref('');

  const discountAmount = computed(() => applied.value?.discountAmount ?? 0);

  function payable(subtotal: number) {
    return Math.max(0, subtotal - discountAmount.value);
  }

  async function apply(subtotal: number, customerPhone?: string) {
    const next = code.value.trim();
    if (next.length < 2) {
      error.value = 'کد تخفیف را وارد کنید';
      return false;
    }
    if (subtotal <= 0) {
      error.value = 'سبد خرید خالی است';
      return false;
    }
    applying.value = true;
    error.value = '';
    try {
      const { data } = await api.post<AppliedCoupon>('/coupons/validate', {
        code: next,
        subtotal,
        customerPhone: customerPhone || undefined,
      });
      applied.value = data;
      code.value = data.code;
      return true;
    } catch (e: unknown) {
      applied.value = null;
      error.value = e instanceof Error ? e.message : 'کد تخفیف معتبر نیست';
      return false;
    } finally {
      applying.value = false;
    }
  }

  async function refresh(subtotal: number, customerPhone?: string) {
    if (!applied.value) return;
    code.value = applied.value.code;
    if (subtotal <= 0) {
      clear();
      return;
    }
    if (applied.value.subtotal === subtotal) return;
    await apply(subtotal, customerPhone);
  }

  function clear() {
    applied.value = null;
    error.value = '';
  }

  return { code, applying, error, applied, discountAmount, payable, apply, refresh, clear };
}
