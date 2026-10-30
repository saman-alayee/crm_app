import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bannerConditionText, bannerNoteText, bannerPhoneText, bannerPriceText, channelPostModeLabel, listChannelBannerFiles,
  nextRandomTurnBanner, normalizeChannelPostMode, resolveChannelBannerPath, shuffleBannerFiles
} from '../src/channel/channel-banner.js';

test('banner formats phone and dotted price like the sample', () => {
  assert.equal(bannerPhoneText({ phone_number: '09121573758', phone_display: '0912 157 37 58' }), '0912 157 37 58');
  assert.equal(bannerPhoneText({ phone_number: '09121573758', phone_display: '09121573758' }), '09121573758');
  assert.equal(bannerPhoneText({ phone_number: '09121573758' }), '09121573758');
  assert.equal(bannerPriceText({ price_toman: 580_000_000 }), '580.000.000');
  assert.equal(bannerConditionText({ condition_text: 'کارکرده/ پله اول و آخر' }), 'کارکرده/ پله اول و آخر');
  assert.equal(
    bannerConditionText({ condition_text: 'کارکرده', public_note: 'صفر وسط' }),
    'کارکرده / صفر وسط'
  );
  assert.equal(bannerNoteText({ public_note: '  رند خاص  ' }), 'رند خاص');
  assert.equal(bannerNoteText({ public_note: '-' }), '');
  assert.equal(bannerNoteText({ public_note: '' }), '');
});

test('banner templates rotate random-turn without repeat until cycle ends', () => {
  const files = listChannelBannerFiles();
  assert.ok(files.length >= 1);
  assert.match(resolveChannelBannerPath(null) || '', /banner-\d+\./);
  let queue = [];
  const seen = [];
  for (let i = 0; i < files.length; i += 1) {
    const step = nextRandomTurnBanner(files, queue, () => 0.99);
    seen.push(step.file);
    queue = step.nextQueue;
  }
  assert.equal(new Set(seen).size, files.length);
  const reshuffled = nextRandomTurnBanner(files, queue, () => 0.1);
  assert.ok(files.includes(reshuffled.file));
  assert.equal(shuffleBannerFiles(['a', 'b', 'c'], () => 0).length, 3);
});

test('channel post mode is selectable between text, photo, and both', () => {
  assert.equal(normalizeChannelPostMode('text'), 'text');
  assert.equal(normalizeChannelPostMode('photo'), 'photo');
  assert.equal(normalizeChannelPostMode('both'), 'both');
  assert.equal(normalizeChannelPostMode('0'), 'text');
  assert.equal(normalizeChannelPostMode('1'), 'photo');
  assert.equal(normalizeChannelPostMode('2'), 'both');
  assert.equal(normalizeChannelPostMode('both', { hasTemplates: false }), 'text');
  assert.equal(channelPostModeLabel('photo'), 'با تصویر (بنر)');
  assert.equal(channelPostModeLabel('both'), 'متنی + تصویری');
  assert.equal(channelPostModeLabel('text'), 'متنی');
});
