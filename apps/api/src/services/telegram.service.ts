import { config } from '../config/index.js';

const TG_API = 'https://api.telegram.org';

export function isTelegramConfigured() {
  return Boolean(config.telegram.botToken?.trim());
}

export async function sendTelegramMessage(input: {
  chatId: string | number;
  text: string;
  parseMode?: 'HTML' | 'Markdown';
  replyMarkup?: unknown;
}) {
  if (!isTelegramConfigured()) {
    return { ok: false as const, skipped: true as const, error: 'TELEGRAM_BOT_TOKEN missing' };
  }

  const res = await fetch(`${TG_API}/bot${config.telegram.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: input.chatId,
      text: input.text.slice(0, 4000),
      parse_mode: input.parseMode || 'HTML',
      disable_web_page_preview: true,
      reply_markup: input.replyMarkup,
    }),
  });

  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    return { ok: false as const, skipped: false as const, error: data.description || 'send failed' };
  }
  return { ok: true as const, skipped: false as const };
}
