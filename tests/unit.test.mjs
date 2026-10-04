// Pure unit tests (no server needed): node --test tests/unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, needsRehash, randomId, safeEqual } from '../functions/_lib/crypto.js';
import { validateEmail, validatePassword, validateHandle, validatePrice, validateTags, validateUrl, cleanText, slugify } from '../functions/_lib/validate.js';
import { sniffImage } from '../functions/_lib/images.js';
import { esc, jsonLd, safeHref } from '../functions/_lib/html.js';

test('password hashing is salted and verifiable', async () => {
  const a = await hashPassword('correct horse battery 7', 20000);
  const b = await hashPassword('correct horse battery 7', 20000);
  assert.notEqual(a, b);
  assert.match(a, /^pbkdf2\$sha256\$20000\$[\w-]+\$[\w-]+$/);
  assert.equal(await verifyPassword('correct horse battery 7', a), true);
  assert.equal(await verifyPassword('wrong', a), false);
  assert.equal(await verifyPassword('x', 'garbage'), false);
  assert.equal(needsRehash(a, 100000), true);
  assert.equal(await safeEqual('abc', 'abc'), true);
  assert.equal(await safeEqual('abc', 'abd'), false);
  assert.match(randomId(12), /^[a-z0-9]{12}$/);
});

test('validators', () => {
  assert.equal(validateEmail(' A@Example.com ').value, 'a@example.com');
  for (const e of ['x', 'a@b', 'a b@c.com', 'a@@c.com', '<a>@c.com', 'a@c..com']) assert.equal(validateEmail(e).ok, false, e);
  assert.equal(validatePassword('short').ok, false);
  assert.equal(validatePassword('x'.repeat(129)).ok, false);
  assert.equal(validatePassword('a long unusual passphrase').ok, true);
  assert.equal(validateHandle('@Good-Handle').value, 'good-handle');
  for (const h of ['ab', '-bad', 'bad-', 'bad--x', 'UPPER_', 'admin', 'x'.repeat(31)]) assert.equal(validateHandle(h).ok, h === 'UPPER_' ? false : false, h);
  assert.equal(validatePrice('1200', 'INR').value, 120000);
  assert.equal(validatePrice('49.5', 'USD').value, 4950);
  assert.equal(validatePrice('0.50', 'USD').ok, false);
  assert.equal(validatePrice('1e3', 'USD').ok, false);
  assert.equal(validatePrice('10', 'JPY').ok, false);
  assert.deepEqual(validateTags('A, b ,a').value, ['a', 'b']);
  assert.equal(validateTags(['<x>']).ok, false);
  assert.equal(validateUrl('javascript:alert(1)').ok, false);
  assert.equal(validateUrl('data:text/html,hi').ok, false);
  assert.equal(validateUrl('https://example.com/a b').ok, false);
  assert.equal(validateUrl('https://example.com/x').ok, true);
  assert.equal(cleanText('a\u202Eb').ok, false);
  assert.equal(slugify('Café Déjà Vu!'), 'cafe-deja-vu');
});

test('image sniffing', () => {
  assert.equal(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
  assert.equal(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  assert.equal(sniffImage(new TextEncoder().encode('GIF89a')), null);
  assert.equal(sniffImage(new TextEncoder().encode('<svg></svg>')), null);
});

test('escaping', () => {
  assert.equal(esc(`<a href="x" onclick='y'>&\``), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&#96;');
  assert.equal(jsonLd({ a: '</script><b>' }).includes('<'), false);
  assert.equal(safeHref('javascript:alert(1)'), '#');
  assert.equal(safeHref('https://example.com/'), 'https://example.com/');
});
