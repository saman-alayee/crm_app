import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { botLinkUsername, esc, listingPriceBreakdown, toLatinDigits } from '../domain/format.js';
import { CHANNEL_MSG_DEFAULTS, renderChannelDocumentLine } from './channel-messages.js';
import { channelMsgHtmlFragment } from '../telegram/telegram-text.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const bannersDir = path.join(here, '../../assets/channel-banners');
const fontsDir = path.join(here, '../fonts');

let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  const black = path.join(fontsDir, 'Vazirmatn-Black.ttf');
  const bold = path.join(fontsDir, 'Vazirmatn-Bold.ttf');
  const regular = path.join(fontsDir, 'Vazirmatn-Regular.ttf');
  if (fs.existsSync(black)) GlobalFonts.registerFromPath(black, 'BannerBlack');
  if (fs.existsSync(bold)) GlobalFonts.registerFromPath(bold, 'BannerBold');
  if (fs.existsSync(regular)) GlobalFonts.registerFromPath(regular, 'BannerRegular');
  fontsReady = true;
}

export function listChannelBannerFiles() {
  if (!fs.existsSync(bannersDir)) return [];
  return fs.readdirSync(bannersDir)
    .filter((name) => /^banner-\d+\.(png|jpe?g|webp)$/i.test(name))
    .sort();
}

/** حالت انتشار کانال: text | photo | both */
export function normalizeChannelPostMode(raw, { hasTemplates = true } = {}) {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'text' || value === '0' || value === 'off' || value === 'false') return 'text';
  if (value === 'both' || value === 'all' || value === 'text_photo' || value === 'photo_text' || value === '2') {
    return hasTemplates ? 'both' : 'text';
  }
  if (value === 'photo' || value === 'image' || value === 'banner' || value === '1' || value === 'on' || value === 'true') {
    return hasTemplates ? 'photo' : 'text';
  }
  return hasTemplates ? 'photo' : 'text';
}

export function channelPostModeLabel(mode) {
  if (mode === 'photo') return 'با تصویر (بنر)';
  if (mode === 'both') return 'متنی + تصویری';
  return 'متنی';
}

/** کپشن تلگرام حداکثر ۱۰۲۴ کاراکتر */
export function clipTelegramCaption(html, max = 1024) {
  const text = String(html || '');
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function resolveChannelBannerPath(preferred) {
  const files = listChannelBannerFiles();
  if (!files.length) return null;
  const want = String(preferred || '').trim();
  if (want && files.includes(want)) return path.join(bannersDir, want);
  return path.join(bannersDir, files[0]);
}

/** بر زدن تصادفی آرایه (Fisher–Yates) */
export function shuffleBannerFiles(files, rng = Math.random) {
  const out = [...files];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * نوبت رندوم: از صف شافل‌شده یکی برمی‌دارد؛
 * وقتی صف خالی شد دوباره همه قالب‌ها را تصادفی می‌چیند.
 */
export function nextRandomTurnBanner(files, queue = [], rng = Math.random) {
  if (!files.length) return { file: null, nextQueue: [] };
  const known = new Set(files);
  let q = (Array.isArray(queue) ? queue : []).filter((name) => known.has(name));
  if (!q.length) q = shuffleBannerFiles(files, rng);
  const file = q[0];
  return { file, nextQueue: q.slice(1) };
}

/** سازگاری با کد قبلی — انتخاب مستقیم بدون صف */
export function selectChannelBannerFile(row, preferred) {
  const files = listChannelBannerFiles();
  if (!files.length) return null;
  const want = String(preferred || '').trim();
  if (want && files.includes(want)) return want;
  const id = Math.max(0, Number(row?.id) || 0);
  return files[id % files.length];
}

export function parseBannerQueue(raw) {
  try {
    const parsed = JSON.parse(String(raw || '[]'));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function parseBannerAssignments(raw) {
  try {
    const parsed = JSON.parse(String(raw || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** قیمت با جداکننده نقطه مثل نمونه: 580.000.000 */
export function bannerPriceText(row) {
  const { final } = listingPriceBreakdown(row);
  return Math.round(Number(final) || 0).toLocaleString('de-DE');
}

export function bannerPhoneText(row) {
  const typed = String(row.phone_display || '').trim();
  if (typed) {
    const kept = toLatinDigits(typed).replace(/[^\d\s\-\.]/g, '').replace(/\s+/g, ' ').trim();
    if (kept) return kept;
  }
  return toLatinDigits(row.phone_number || '').replace(/\D/g, '') || String(row.phone_number || '').trim();
}

/** توضیحات کانال (ستون توضیحات اکسل) */
export function bannerNoteText(row) {
  const note = String(row.public_note || '').trim();
  if (!note || note === '-') return '';
  return note.replace(/\s+/g, ' ').slice(0, 80);
}

/**
 * وضعیت + ویژگی در یک خط، مثل نمونه: «کارکرده / صفر وسط»
 * وضعیت از ستون وضعیت؛ ویژگی از توضیحات کانال.
 */
export function bannerConditionText(row) {
  const condition = String(row.condition_text || '').trim() || '-';
  const note = bannerNoteText(row);
  if (!note) return condition;
  // اگر توضیح از قبل داخل وضعیت باشد تکرار نکن
  if (condition.includes(note)) return condition;
  return `${condition} / ${note}`;
}

function fitFont(ctx, text, family, maxWidth, startSize, minSize = 28) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  ctx.font = `${minSize}px ${family}`;
  return minSize;
}

function drawCentered(ctx, text, y, family, startSize, maxWidth) {
  const size = fitFont(ctx, text, family, maxWidth, startSize);
  ctx.font = `${size}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.strokeStyle = '#111111';
  ctx.fillStyle = '#111111';
  const x = ctx.canvas.width / 2;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  return size;
}

/**
 * رندر بنر پست کانال — تایپوگرافی شبیه نمونه پرشده:
 * شماره · وضعیت · قیمت · توضیحات (در صورت وجود)
 */
export async function renderChannelBannerPng(row, { templateFile } = {}) {
  ensureFonts();
  const chosen = templateFile || selectChannelBannerFile(row);
  const templatePath = resolveChannelBannerPath(chosen);
  if (!templatePath) throw new Error('NO_BANNER_TEMPLATE');
  const img = await loadImage(templatePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, img.width, img.height);

  const phone = bannerPhoneText(row);
  const condition = bannerConditionText(row);
  const price = bannerPriceText(row);
  const maxWidth = img.width * 0.9;
  const gap = img.height * 0.095;
  // بین لوگو و وسط تصویر — کمی پایین‌تر از نسخهٔ خیلی بالا
  const startY = img.height * 0.48;

  const lines = [
    { text: phone, family: 'BannerBlack', size: Math.round(img.width * 0.118) },
    { text: condition, family: 'BannerBlack', size: Math.round(img.width * 0.078) },
    { text: price, family: 'BannerBlack', size: Math.round(img.width * 0.118) }
  ];
  lines.forEach((line, index) => {
    drawCentered(ctx, line.text, startY + index * gap, line.family, line.size, maxWidth);
  });

  return canvas.toBuffer('image/png');
}

function channelForSale(row) {
  return row?.status === 'active' || row?.status === 'ready_transfer';
}

/**
 * کپشن کوتاه زیر تصویر (fallback).
 * مسیر اصلی syncChannel از channelText استفاده می‌کند تا توضیحات هم بیاید.
 */
export function channelBannerCaption(row, { bot, calcUrl, installmentEnabled = true, statusMessages = null, statusEntities = null }) {
  const msgs = statusMessages || CHANNEL_MSG_DEFAULTS;
  const ents = statusEntities || {};
  const statusHtml = (key) => channelMsgHtmlFragment(msgs[key], ents[key]);
  const lines = [];
  lines.push(esc(renderChannelDocumentLine(row.document_ready_date, msgs)));
  if (row.special_sale_applied_at) lines.push(statusHtml('channel_msg_special_badge'));
  if (row.status === 'reserved') lines.push(statusHtml('channel_msg_reserved'));
  if (row.status === 'ready_transfer') lines.push(statusHtml('channel_msg_ready_transfer'));
  if (channelForSale(row)) {
    const links = [];
    if (installmentEnabled) links.push(`<a href="${calcUrl}">${esc(msgs.channel_msg_link_installment)}</a>`);
    links.push(`<a href="https://t.me/${botLinkUsername(bot)}?start=cash_${row.id}">${esc(msgs.channel_msg_link_cash)}</a>`);
    lines.push(links.join('   |   '));
  }
  return lines.filter(Boolean).join('\n');
}

export async function telegramSendPhoto({ token, chatId, png, caption, replyMarkup }) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) {
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
  }
  if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
  form.append('photo', new Blob([png], { type: 'image/png' }), 'listing.png');
  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
  return response.json();
}

export async function telegramEditMessageMedia({ token, chatId, messageId, png, caption, replyMarkup }) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('message_id', String(messageId));
  const media = {
    type: 'photo',
    media: 'attach://photo',
    caption: caption || '',
    parse_mode: 'HTML'
  };
  form.append('media', JSON.stringify(media));
  if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
  form.append('photo', new Blob([png], { type: 'image/png' }), 'listing.png');
  const response = await fetch(`https://api.telegram.org/bot${token}/editMessageMedia`, { method: 'POST', body: form });
  return response.json();
}
