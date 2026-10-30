const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
}

/** Normalize Persian/Arabic text for product search. */
export function normalizeSearchText(value: string): string {
  return normalizeDigits(value)
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Variants so DB rows with Arabic ی/ک still match Persian keyboards. */
export function searchTermVariants(term: string): string[] {
  const base = normalizeSearchText(term);
  if (!base) return [];
  const variants = new Set<string>([base]);
  variants.add(base.replace(/ی/g, 'ي').replace(/ک/g, 'ك'));
  return [...variants];
}

export function normalizePhone(phone: string): string {
  let normalized = normalizeDigits(phone).replace(/\D/g, '');
  if (normalized.startsWith('98')) normalized = '0' + normalized.slice(2);
  if (!normalized.startsWith('0')) normalized = '0' + normalized;
  if (!/^09\d{9}$/.test(normalized)) {
    throw new Error('INVALID_PHONE');
  }
  return normalized;
}
