const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
}

export function normalizePhoneInput(phone: string): string {
  let normalized = normalizeDigits(phone).replace(/\D/g, '');
  if (normalized.startsWith('98')) normalized = '0' + normalized.slice(2);
  if (normalized && !normalized.startsWith('0')) normalized = '0' + normalized;
  return normalized;
}
