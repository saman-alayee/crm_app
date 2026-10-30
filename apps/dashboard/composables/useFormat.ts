import { formatJalaliDate, formatJalaliMonthYear } from '~/utils/jalali';

export function toPersianDigits(num: number | string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/\d/g, (d) => persianDigits[parseInt(d, 10)]);
}

export function formatNumber(num: number): string {
  if (num == null || Number.isNaN(num)) return '۰';
  return Math.round(num).toLocaleString('fa-IR');
}

export function formatPrice(price: number): string {
  return `${formatNumber(price)} تومان`;
}

export function formatDate(date: string | Date): string {
  return formatJalaliDate(date, { withTime: true });
}

export function formatShortDate(date: string | Date): string {
  return formatJalaliDate(date, { short: true });
}

export function useFormat() {
  return {
    toPersianDigits,
    formatNumber,
    formatPrice,
    formatDate,
    formatShortDate,
    formatMonthYear: formatJalaliMonthYear,
  };
}
