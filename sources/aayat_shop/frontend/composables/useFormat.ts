import { formatJalaliDate, formatJalaliMonthYear, getTodayJalali } from '~/utils/jalali';
import {
  getCategoryImage,
  getProductImage,
  resolveMediaUrl,
} from '~/utils/mediaUrl';

export function toPersianDigits(num: number | string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/\d/g, (d) => persianDigits[parseInt(d, 10)]);
}

/** Format number with Persian digits and thousands separator (٬) */
export function formatNumber(num: number): string {
  if (num == null || Number.isNaN(num)) return '۰';
  return Math.round(num).toLocaleString('fa-IR');
}

/** Format price with thousands separator + تومان */
export function formatPrice(price: number): string {
  return `${formatNumber(price)} تومان`;
}

/** Compact price for small product cards (number only). */
export function formatPriceCompact(price: number): string {
  return formatNumber(price);
}

export function formatDate(date: string | Date): string {
  return formatJalaliDate(date, { withTime: true });
}

export function formatShortDate(date: string | Date): string {
  return formatJalaliDate(date, { short: true });
}

export function formatMonthYear(date: string | Date): string {
  return formatJalaliMonthYear(date);
}

export function formatJalaliYear(): string {
  return toPersianDigits(getTodayJalali().year);
}

export function useFormat() {
  return {
    toPersianDigits,
    formatNumber,
    formatPrice,
    formatPriceCompact,
    formatDate,
    formatShortDate,
    formatMonthYear,
    formatJalaliYear,
    resolveMediaUrl,
    getProductImage,
    getCategoryImage,
  };
}
