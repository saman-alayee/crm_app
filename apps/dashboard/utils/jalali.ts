import dayjs from 'dayjs';
import jalaliday from 'jalaliday';

dayjs.extend(jalaliday);

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

export const JALALI_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;

function parseInput(date: string | Date): dayjs.Dayjs {
  if (typeof date === 'string') {
    const value = date.includes('T') ? date : `${date.slice(0, 10)}T12:00:00`;
    return dayjs(value);
  }
  return dayjs(date);
}

function toJalali(date: string | Date) {
  return parseInput(date).calendar('jalali');
}

/** Saturday-first weekday index (ش=0 … ج=6) */
export function getJalaliWeekdayIndex(jYear: number, jMonth: number, jDay: number): number {
  const weekday = dayjs(`${jYear}/${jMonth}/${jDay}`, { jalali: true }).day();
  return (weekday + 1) % 7;
}

export function getJalaliMonthLength(jYear: number, jMonth: number): number {
  return dayjs(`${jYear}/${jMonth}/1`, { jalali: true }).daysInMonth();
}

export function gregorianIsoToJalali(iso: string): { year: number; month: number; day: number } {
  const d = toJalali(iso);
  return { year: d.year(), month: d.month() + 1, day: d.date() };
}

export function jalaliToGregorianIso(jYear: number, jMonth: number, jDay: number): string {
  return dayjs(`${jYear}/${jMonth}/${jDay}`, { jalali: true }).calendar('gregory').format('YYYY-MM-DD');
}

export function formatJalaliMonthYear(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const jalali = toJalali(date);
  return `${JALALI_MONTHS[jalali.month()]} ${toPersianDigits(jalali.year())}`;
}

export function formatJalaliDate(
  date: string | Date | null | undefined,
  options: { short?: boolean; withTime?: boolean } = {}
): string {
  if (!date) return '—';

  const source = parseInput(date);
  const jalali = source.calendar('jalali');
  const month = JALALI_MONTHS[jalali.month()];
  const day = toPersianDigits(jalali.date());
  const year = toPersianDigits(jalali.year());

  // Persian month names must stay whole — slice(0,3) turns «آبان» into «آبا»
  let text = `${day} ${month} ${year}`;

  if (options.withTime) {
    const hours = toPersianDigits(source.format('HH'));
    const minutes = toPersianDigits(source.format('mm'));
    text += `، ${hours}:${minutes}`;
  }

  return text;
}

export function formatJalaliInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const { year, month, day } = gregorianIsoToJalali(iso.slice(0, 10));
  return `${toPersianDigits(year)}/${toPersianDigits(String(month).padStart(2, '0'))}/${toPersianDigits(String(day).padStart(2, '0'))}`;
}

export function getTodayGregorianIso(): string {
  return dayjs().format('YYYY-MM-DD');
}

export function getTodayJalali(): { year: number; month: number; day: number } {
  const today = dayjs().calendar('jalali');
  return { year: today.year(), month: today.month() + 1, day: today.date() };
}

export function compareGregorianIso(a: string, b: string): number {
  return a.localeCompare(b);
}

export function toPersianDigits(value: number | string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(value).replace(/\d/g, (d) => persianDigits[Number(d)]);
}

export function toEnglishDigits(value: string): string {
  return String(value)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** Parse typed display like ۱۴۰۳/۰۱/۱۵ or 1403/1/15 → gregorian ISO or null */
export function parseJalaliDisplayToIso(raw: string): string | null {
  const normalized = toEnglishDigits(raw).trim().replace(/-/g, '/');
  const m = normalized.match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1300 || year > 1500 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const maxDay = getJalaliMonthLength(year, month);
  if (day > maxDay) return null;
  const iso = jalaliToGregorianIso(year, month, day);
  // round-trip check
  const back = gregorianIsoToJalali(iso);
  if (back.year !== year || back.month !== month || back.day !== day) return null;
  return iso;
}

export function combineDateAndTime(isoDate: string, timeHm: string): string {
  const t = timeHm && /^\d{2}:\d{2}/.test(timeHm) ? timeHm.slice(0, 5) : '00:00';
  return `${isoDate.slice(0, 10)}T${t}:00`;
}

export function splitDateTimeLocal(value: string | null | undefined): { date: string; time: string } {
  if (!value) return { date: '', time: '' };
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const [datePart, timePart = ''] = normalized.split('T');
  return {
    date: datePart.slice(0, 10),
    time: timePart ? timePart.slice(0, 5) : '',
  };
}

export { dayjs };
