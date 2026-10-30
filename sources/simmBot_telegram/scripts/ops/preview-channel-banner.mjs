import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderChannelBannerPng } from '../../src/channel/channel-banner.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'assets/channel-banners/preview-test.png');
const png = await renderChannelBannerPng({
  phone_number: '09121573758',
  condition_text: 'کارکرده/ پله اول و آخر',
  public_note: 'توضیحات تستی سیم‌کارت',
  price_toman: 580_000_000
}, { templateFile: 'banner-02.png' });
fs.writeFileSync(out, png);
console.log('WROTE', out, png.length);
