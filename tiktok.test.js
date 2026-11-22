import { test } from 'node:test';
import assert from 'node:assert/strict';
import { userOf, giftEvent, avatarAllowed } from './tiktok.js';

test('userOf acepta el formato crudo y el legacy', () => {
  assert.deepEqual(userOf({ user: { displayId: 'ana_pe', nickname: 'Ana', avatarThumb: { urlList: ['https://p16.tiktokcdn.com/a.jpg'] } } }),
    { user: 'ana_pe', avatar: 'https://p16.tiktokcdn.com/a.jpg' });
  assert.deepEqual(userOf({ user: { uniqueId: 'beto', profilePictureUrl: 'x' } }), { user: 'beto', avatar: 'x' });
  assert.equal(userOf({}).user, '');
});

test('giftEvent: racha se cuenta al final y multiplica', () => {
  const rosa = { user: { uniqueId: 'a' }, giftDetails: { giftType: 1, diamondCount: 1 }, repeatCount: 5 };
  assert.equal(giftEvent({ ...rosa, repeatEnd: false }), null);
  assert.equal(giftEvent({ ...rosa, repeatEnd: true }).diamonds, 5);
  assert.equal(giftEvent({ user: { displayId: 'b' }, gift: { type: 2, diamondCount: 99 }, repeatCount: 1, repeatEnd: 0 }).diamonds, 99);
  assert.equal(giftEvent({ user: { uniqueId: 'c' }, giftDetails: { giftType: 2, diamondCount: 0 } }), null);
});

test('avatarAllowed solo deja pasar el CDN de TikTok', () => {
  assert.ok(avatarAllowed('https://p16-sign-va.tiktokcdn.com/x.jpeg'));
  assert.ok(avatarAllowed('https://p77.tiktokcdn-us.com/x.webp'));
  assert.ok(!avatarAllowed('http://p16.tiktokcdn.com/x.jpg'));
  assert.ok(!avatarAllowed('https://tiktokcdn.com.evil.com/x.jpg'));
  assert.ok(!avatarAllowed('https://localhost/x'));
  assert.ok(!avatarAllowed(null));
});
