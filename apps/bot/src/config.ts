import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config();

export const botConfig = {
  token: process.env.TELEGRAM_BOT_TOKEN || '',
  apiBase: (process.env.BOT_API_BASE || process.env.NUXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000/api/v1').replace(
    /\/$/,
    ''
  ),
  botKey: process.env.BOT_INTERNAL_API_KEY || 'dev-bot-internal-key',
};
