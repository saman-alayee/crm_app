import {
  NATIONWIDE_SHIPPING_FEE,
  SHIPPING_OPTIONS,
  type ShippingMethod,
} from '~/constants/shipping';

export interface ShippingSettings {
  nationwideFee: number;
  nationwideHint: string;
  cartHoldMinutes: number;
}

const DEFAULT_HINT =
  SHIPPING_OPTIONS.find((item) => item.value === 'NATIONWIDE')?.hint ||
  'پرداخت هزینه پست در محل (هنگام تحویل) انجام می‌شود';

export function useShippingSettings() {
  const api = useApi();
  const nationwideFee = ref(NATIONWIDE_SHIPPING_FEE);
  const nationwideHint = ref(DEFAULT_HINT);
  const cartHoldMinutes = ref(30);
  const loaded = ref(false);

  const shippingOptions = computed(() =>
    SHIPPING_OPTIONS.map((option) =>
      option.value === 'NATIONWIDE'
        ? { ...option, fee: nationwideFee.value, hint: nationwideHint.value }
        : option
    )
  );

  function feeFor(method: ShippingMethod) {
    return shippingOptions.value.find((item) => item.value === method)?.fee ?? 0;
  }

  async function loadShippingSettings() {
    try {
      const { data } = await api.get<ShippingSettings>('/settings/shipping');
      if (typeof data.nationwideFee === 'number' && Number.isFinite(data.nationwideFee)) {
        nationwideFee.value = Math.max(0, Math.round(data.nationwideFee));
      }
      if (typeof data.nationwideHint === 'string' && data.nationwideHint.trim()) {
        nationwideHint.value = data.nationwideHint.trim();
      }
      if (typeof data.cartHoldMinutes === 'number' && Number.isFinite(data.cartHoldMinutes)) {
        cartHoldMinutes.value = Math.max(5, Math.round(data.cartHoldMinutes));
      }
    } catch {
      /* keep defaults */
    } finally {
      loaded.value = true;
    }
  }

  return {
    nationwideFee,
    nationwideHint,
    cartHoldMinutes,
    loaded,
    shippingOptions,
    feeFor,
    loadShippingSettings,
  };
}
