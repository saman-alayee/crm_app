import http from 'node:http';
import fs from 'node:fs';

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const splitAt = trimmed.indexOf('=');
    if (splitAt < 1) continue;
    const key = trimmed.slice(0, splitAt).trim();
    let value = trimmed.slice(splitAt + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] == null || process.env[key] === '') process.env[key] = value;
  }
}

loadEnv('/opt/simmbot/.env');
loadEnv('.env');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token || !process.env.DATABASE_URL) {
  console.error('TELEGRAM_BOT_TOKEN or DATABASE_URL missing');
  process.exit(1);
}

const [
  { default: telegram },
  { default: calc },
  { default: cron },
  { default: setup },
  { default: init }
] = await Promise.all([
  import('../../api/telegram.js'),
  import('../../api/calc.js'),
  import('../../api/cron.js'),
  import('../../api/setup.js'),
  import('../../api/init.js')
]);

const port = Number(process.env.PORT || 8787);
const bindHost = String(process.env.BIND_HOST || '0.0.0.0').trim() || '0.0.0.0';
const routes = {
  '/api/telegram': telegram,
  '/api/calc': calc,
  '/api/cron': cron,
  '/api/setup': setup,
  '/api/init': init
};

function log(message) {
  console.log(`${new Date().toISOString()} ${message}`);
}

function isLoopback(req) {
  const raw = String(req.socket?.remoteAddress || '');
  return raw === '127.0.0.1' || raw === '::1' || raw === '::ffff:127.0.0.1';
}

async function telegramApi(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  return response.json();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  // On VPS we poll; never let public callers re-point the webhook or run migrate.
  if ((url.pathname === '/api/setup' || url.pathname === '/api/init') && !isLoopback(req)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  if (url.pathname === '/api/cron' && !isLoopback(req)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  const handler = routes[url.pathname] || null;
  if (!handler) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('SamiSIM bot is running. Installment page: /api/calc?listing=ID');
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks)
    });
    const response = await handler.fetch(request);
    const body = Buffer.from(await response.arrayBuffer());
    const headers = Object.fromEntries(response.headers);
    res.writeHead(response.status, headers);
    res.end(body);
  } catch (error) {
    log(`http ${error.message}`);
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('error');
  }
});

async function runJobs() {
  try {
    const request = new Request(`http://127.0.0.1:${port}/api/cron`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET || ''}` }
    });
    const response = await cron.fetch(request);
    const text = await response.text();
    log(`cron ${response.status} ${text.slice(0, 240)}`);
  } catch (error) {
    log(`cron failed ${error.message}`);
  }
}

let offset = 0;
let pollBackoffMs = 1000;
async function poll() {
  while (true) {
    try {
      const data = await telegramApi('getUpdates', {
        offset,
        timeout: 25,
        allowed_updates: ['message', 'callback_query']
      });
      if (!data.ok) {
        log(`getUpdates ${data.description || 'failed'}`);
        await new Promise((resolve) => setTimeout(resolve, Math.min(pollBackoffMs, 30000)));
        pollBackoffMs = Math.min(pollBackoffMs * 2, 30000);
        continue;
      }
      pollBackoffMs = 1000;
      for (const update of data.result || []) {
        offset = update.update_id + 1;
        const headers = { 'content-type': 'application/json' };
        const { webhookSecretToken } = await import('../../src/telegram/webhook-secret.js');
        const secret = webhookSecretToken();
        if (secret) headers['x-telegram-bot-api-secret-token'] = secret;
        const request = new Request(`http://127.0.0.1:${port}/api/telegram`, {
          method: 'POST',
          headers,
          body: JSON.stringify(update)
        });
        const response = await telegram.fetch(request);
        if (response.status !== 200) log(`update ${response.status} ${(await response.text()).slice(0, 180)}`);
      }
    } catch (error) {
      const cause = error?.cause?.code || error?.cause?.message || '';
      log(`poll ${error.message}${cause ? ` (${cause})` : ''}`);
      await new Promise((resolve) => setTimeout(resolve, Math.min(pollBackoffMs, 30000)));
      pollBackoffMs = Math.min(pollBackoffMs * 2, 30000);
    }
  }
}

const cleared = await telegramApi('deleteWebhook', { drop_pending_updates: false });
log(cleared.ok ? 'webhook removed; polling' : `deleteWebhook ${cleared.description || 'failed'}`);

server.listen(port, bindHost, () => {
  log(`listening on ${bindHost}:${port}`);
  runJobs();
  setInterval(runJobs, 5 * 60 * 1000);
  poll();
});
