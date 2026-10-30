import { CHANNEL_MSG_DEFAULTS, renderChannelDocumentLine } from './channel-messages.js';
import { bannerConditionText, bannerPriceText } from './channel-banner.js';
import { botLinkUsername, esc, formatPhoneDisplay } from '../domain/format.js';
import { channelMsgHtmlFragment } from '../telegram/telegram-text.js';

function channelForSale(row) {
  return row?.status === 'active' || row?.status === 'ready_transfer';
}

export function channelText(row, { bot, calcUrl, installmentEnabled = true, statusMessages = null, statusEntities = null }) {
  const msgs = statusMessages || CHANNEL_MSG_DEFAULTS;
  const ents = statusEntities || {};
  const statusHtml = (key) => channelMsgHtmlFragment(msgs[key], ents[key]);
  // فاصله فقط از تایپ دستی ادمین (phone_display)
  const phoneHtml = formatPhoneDisplay(row.phone_number, row.phone_display).replace(/[\u2066\u2069]/g, '');
  const lines = [
    `<b><code>${esc(phoneHtml)}</code></b>`,
    esc(bannerConditionText(row)),
    `<b>${esc(bannerPriceText(row))}</b>`
  ];
  if (row.special_sale_applied_at) lines.push(statusHtml('channel_msg_special_badge'));
  lines.push(esc(renderChannelDocumentLine(row.document_ready_date, msgs)));
  if (row.status === 'reserved') lines.push(statusHtml('channel_msg_reserved'));
  if (row.status === 'ready_transfer') lines.push(statusHtml('channel_msg_ready_transfer'));
  if (row.status === 'sold') lines.push(statusHtml('channel_msg_sold'));
  if (channelForSale(row)) {
    const links = [];
    if (installmentEnabled) links.push(`<a href="${calcUrl}">${esc(msgs.channel_msg_link_installment)}</a>`);
    links.push(`<a href="https://t.me/${botLinkUsername(bot)}?start=cash_${row.id}">${esc(msgs.channel_msg_link_cash)}</a>`);
    lines.push(links.join('   |   '));
  }
  return lines.join('\n');
}

/** لینک خرید فقط داخل متن آگهی است؛ دکمهٔ شیشه‌ای زیر پست نمی‌گذاریم. */
export function channelPurchaseKeyboard() {
  return { inline_keyboard: [] };
}

export function calcUrlFor(origin, listingId) {
  const base = String(process.env.PUBLIC_CALC_BASE_URL || origin || '').replace(/\/$/, '');
  return `${base}/api/calc?listing=${listingId}`;
}
