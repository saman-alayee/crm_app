export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

/** Username for t.me links (no @ prefix). */
export function botLinkUsername(raw) {
  return String(raw || 'SamiSIM0912Bot').replace(/^@/, '');
}

export function toLatinDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x0660));
}

/** یکسان‌سازی نام مالک/انبار برای تطبیق اکسل با دیتابیس (ی/ي، ک/ك و …). */
export function normalizeLookupName(name) {
  return String(name ?? '')
    .trim()
    .replace(/\u200c/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[يىئ]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[أإآ]/g, 'ا');
}

/** فقط برای سازگاری؛ فاصله‌گذاری اجباری دیگر استفاده نمی‌شود. */
export function formatPhoneDigits(digits) {
  const normalized = toLatinDigits(digits).replace(/\D/g, '');
  if (!/^0912\d{7}$/.test(normalized)) return null;
  return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 9)} ${normalized.slice(9, 11)}`;
}

/**
 * فاصله‌گذاری همان چیزی که ادمین تایپ کرده (فقط رقم‌ها لاتین می‌شوند).
 * فاصله/خط تیره دستی حفظ می‌شود؛ فرمت اجباری اعمال نمی‌شود.
 */
export function preservePhoneDisplay(raw) {
  const typed = toLatinDigits(raw).trim()
    .replace(/[^\d\s\-\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return typed || '';
}

/** نمایش LTR در تلگرام/فارسی — فاصله فقط از phone_display دستی ادمین */
export function formatPhoneDisplay(phoneNumber, optionalDisplay) {
  const digits = toLatinDigits(phoneNumber).replace(/\D/g, '');
  const typed = optionalDisplay != null && String(optionalDisplay).trim() !== ''
    ? preservePhoneDisplay(optionalDisplay)
    : '';
  const typedDigits = typed.replace(/\D/g, '');
  let shown = '';
  if (typed && (!digits || typedDigits === digits)) {
    shown = typed;
  } else if (digits) {
    shown = digits;
  } else {
    shown = typed || String(phoneNumber ?? optionalDisplay ?? '').trim();
  }
  if (!shown) return '-';
  const clean = String(shown).replace(/[\u2066\u2067\u2068\u2069\u200E\u200F]/g, '');
  return `\u2066${clean}\u2069`;
}

/** قیمت LTR در متن فارسی */
export function formatMoneyDisplay(value) {
  return `\u2066${money(value)}\u2069`;
}

export function normalizePhone(raw) {
  const digits = toLatinDigits(raw).replace(/\D/g, '');
  if (!/^0912\d{7}$/.test(digits)) return null;
  const display = preservePhoneDisplay(raw) || digits;
  return { digits, display };
}

export function customerPhone(raw) {
  if (raw == null || raw === '') return null;
  const digits = toLatinDigits(raw).replace(/[^\d+]/g, '');
  if (!/^\+?\d{8,15}$/.test(digits)) return null;
  return digits;
}

export function prefixCode(phone) {
  return Number(String(phone ?? '').match(/^0912(\d)/)?.[1] || 0);
}

export function money(value) {
  return Number(value || 0).toLocaleString('en-US');
}

/** قیمت خط با احتساب فروش ویژه / original_price_toman */
export function listingPriceBreakdown(row) {
  const current = Math.round(Number(row?.price_toman) || 0);
  const storedOriginal = row?.original_price_toman == null ? null : Math.round(Number(row.original_price_toman));
  const original = storedOriginal == null ? current : Math.max(storedOriginal, current);
  const discount = Math.max(0, original - current);
  return { original, final: current, discount, hasDiscount: discount > 0 };
}

export function formatListingPricePlain(row) {
  const b = listingPriceBreakdown(row);
  if (!b.hasDiscount) return `${money(b.final)} تومان`;
  return `قیمت: ${money(b.original)} تومان\nقیمت نهایی: ${money(b.final)} تومان (تخفیف ${money(b.discount)})`;
}

/** HTML کانال — خط خورده + قیمت نهایی */
export function formatListingPriceHtml(row) {
  const b = listingPriceBreakdown(row);
  if (!b.hasDiscount) return `<b>${money(b.final)} تومان</b>`;
  return `<s>${esc(money(b.original))} تومان</s> <b>${money(b.final)} تومان</b> <i>(تخفیف ${esc(money(b.discount))})</i>`;
}

export function jalaliParts(date) {
  const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = formatter.formatToParts(date);
  const read = (type) => Number(toLatinDigits(parts.find((part) => part.type === type)?.value));
  return { year: read('year'), month: read('month'), day: read('day') };
}

export function tehranYmd(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function documentReadyDateIso(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    // ستون date پستگرس به‌صورت UTC نیمه‌شب می‌آید — همان روز تقویمی را نگه دار
    const y = value.getUTCFullYear();
    const m = value.getUTCMonth() + 1;
    const d = value.getUTCDate();
    if (y >= 1900 && y < 2200) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return tehranYmd(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelSerialToIso(value);
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const year = Number(iso[1]);
    // سال شمسی با خط تیره را میلادی اشتباه نگیر
    if (year >= 1300 && year < 1500) return parseDateInput(`${iso[1]}/${iso[2]}/${iso[3]}`);
    if (year >= 1900 && year < 2200) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  return parseDateInput(text);
}

/** سریال تاریخ اکسل → YYYY-MM-DD */
export function excelSerialToIso(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
  const date = new Date(utc);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/**
 * تاریخ سند از ورودی‌های رایج: شمسی، میلادی، Date، سریال اکسل.
 * @returns {string|null} YYYY-MM-DD
 */
export function coerceDocumentDate(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return documentReadyDateIso(raw);
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw > 20000 && raw < 80000) return excelSerialToIso(raw);
    return null;
  }
  const text = String(raw).trim();
  if (!text || text === '-') return null;
  // عدد سریال به‌صورت متن
  if (/^\d+(\.\d+)?$/.test(text)) {
    const asSerial = excelSerialToIso(Number(text));
    if (asSerial) return asSerial;
  }
  return documentReadyDateIso(text) || parseDateInput(text);
}

/** تاریخ سند رسیده یا گذشته (بر اساس تقویم تهران، هم‌تراز cron و CURRENT_DATE). */
export function isDocumentReadyDue(documentReadyDate, now = new Date()) {
  const due = documentReadyDateIso(documentReadyDate);
  if (!due) return false;
  return due <= tehranYmd(now);
}

export function documentReadyLabel(documentReadyDate, { html = false, now = new Date() } = {}) {
  if (!documentReadyDate) return html ? 'تاریخ سند: -' : '-';
  if (isDocumentReadyDue(documentReadyDate, now)) return html ? '✅ <b>آماده سند</b>' : 'آماده سند';
  const jalali = displayJalali(documentReadyDate);
  return html ? `تاریخ سند: ${jalali}` : jalali;
}

export function channelDocumentReadyLine(documentReadyDate, now = new Date()) {
  return documentReadyLabel(documentReadyDate, { html: true, now });
}

export function displayJalali(value) {
  if (!value) return '-';
  const iso = documentReadyDateIso(value);
  const date = iso ? new Date(`${iso}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const parts = jalaliParts(date);
  return `${parts.year}/${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}`;
}

export function displayDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const parts = jalaliParts(date);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${parts.year}/${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')} ${hh}:${mm}`;
}

export function plusDaysISO(days, now = new Date()) {
  const [year, month, day] = tehranYmd(now).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Number(days)));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** موعد سند فروش: تاریخ آماده‌بودن سند، وگرنه امروز تهران. */
export function saleDocumentDueFromReady(documentReadyDate, now = new Date()) {
  return documentReadyDateIso(documentReadyDate) || tehranYmd(now);
}

export function shouldRemindSaleDocument(row, now = new Date()) {
  if (!row || row.status !== 'sold' || String(row.sale_document_status || '') !== 'pending') return false;
  const due = documentReadyDateIso(row.sale_document_due_date);
  if (!due) return false;
  const today = tehranYmd(now);
  if (due > today) return false;
  if (!row.sale_document_last_reminded_at) return true;
  return tehranYmd(new Date(row.sale_document_last_reminded_at)) < today;
}

export function parseDateInput(raw) {
  const normalized = toLatinDigits(raw).trim().replace(/-/g, '/').replace(/\./g, '/');
  const parts = normalized.split('/').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
  if (parts[0] >= 1300 && parts[0] < 1500) {
    const [jy, jm, jd] = parts;
    if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
    const start = Date.UTC(jy + 621, 2, 18, 12);
    for (let offset = 0; offset < 380; offset += 1) {
      const date = new Date(start + offset * 86400000);
      const jalali = jalaliParts(date);
      if (jalali.year === jy && jalali.month === jm && jalali.day === jd) return date.toISOString().slice(0, 10);
    }
    return null;
  }
  if (parts[0] >= 1900 && parts[0] < 2200) {
    const [year, month, day] = parts;
    const out = new Date(Date.UTC(year, month - 1, day));
    if (out.getUTCFullYear() !== year || out.getUTCMonth() !== month - 1 || out.getUTCDate() !== day) return null;
    return out.toISOString().slice(0, 10);
  }
  return null;
}

export function parseListingText(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length !== 3) return null;
  const phone = normalizePhone(lines[0]);
  const priceMillion = Number(toLatinDigits(lines[1]).replace(/,/g, '.'));
  if (!phone || !Number.isFinite(priceMillion) || priceMillion <= 0) return null;
  return {
    phone: phone.digits,
    displayPhone: phone.display,
    price: Math.round(priceMillion * 1_000_000),
    condition: lines[2]
  };
}

export function statusLabel(status) {
  return {
    active: 'موجود',
    reserved: 'رزرو شده',
    sold: 'فروخته شده',
    inactive: 'غیرفعال',
    ready_transfer: 'آماده انتقال'
  }[String(status || '').toLowerCase()] || status || '-';
}
