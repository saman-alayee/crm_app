export const NATIONWIDE_SHIPPING_FEE = 0;

export const SHIPPING_METHODS = {
  PICKUP: { label: 'تحویل حضوری', fee: 0 },
  NATIONWIDE: { label: 'ارسال به سراسر ایران', fee: NATIONWIDE_SHIPPING_FEE },
} as const;

export type ShippingMethod = keyof typeof SHIPPING_METHODS;

export function isShippingMethod(value: unknown): value is ShippingMethod {
  return value === 'PICKUP' || value === 'NATIONWIDE';
}
