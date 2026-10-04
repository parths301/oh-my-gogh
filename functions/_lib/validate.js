// Input validation and normalisation. Every function returns { ok, value } or { ok:false, error }.
// Nothing here trusts the client; HTML escaping happens at output time (see html.js).

export const TERMS_VERSION = 'seller-terms-2026-10-05';

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];
export const MAX_PRICE_MINOR = 100000000; // 1,000,000.00 in any listed currency
export const MAX_STOCK = 1000000;
export const MAX_TAGS = 10;
export const MAX_LINKS = 5;
export const MAX_IMAGES = 6;

const EMAIL_RE = /^[^\s@:<>()[\]\\,;"]{1,64}@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029\u202A-\u202E\u2066-\u2069]/;
// Includes bidi override characters, which can be used to spoof text.

const fail = (error) => ({ ok: false, error });
const good = (value) => ({ ok: true, value });

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', '1234567890', '12345678910',
  'qwertyuiop', 'qwerty12345', 'qwerty123456', 'iloveyou123', 'letmein1234', 'welcome1234', 'admin12345',
  'abc1234567', 'abcdefghij', '0123456789', '1q2w3e4r5t', 'changeme123', 'passw0rd123', 'ohmygogh123',
  'ohmygogh', 'starrynight', 'sunflower1', 'vangogh123',
]);

export function cleanText(input, { min = 0, max = 200, multiline = false, label = 'Text' } = {}) {
  if (input === undefined || input === null) input = '';
  if (typeof input !== 'string') return fail(`${label} must be text.`);
  let s = input.normalize('NFC').replace(/\r\n?/g, '\n');
  if (CONTROL_RE.test(s)) return fail(`${label} contains characters that are not allowed.`);
  if (multiline) {
    s = s.split('\n').map((l) => l.replace(/[ \t]+$/g, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  } else {
    if (/\n|\t/.test(s)) return fail(`${label} must be a single line.`);
    s = s.replace(/\s+/g, ' ').trim();
  }
  if (s.length < min) return fail(min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`);
  if (s.length > max) return fail(`${label} must be at most ${max} characters.`);
  return good(s);
}

export function validateEmail(input) {
  if (typeof input !== 'string') return fail('Please enter a valid email address.');
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email) || email.includes('..') || email.startsWith('.') || email.split('@')[0].endsWith('.')) {
    return fail('Please enter a valid email address.');
  }
  return good(email);
}

export function validatePassword(password, { email = '', handle = '' } = {}) {
  if (typeof password !== 'string') return fail('Please choose a password.');
  if (password.length < 10) return fail('Your password must be at least 10 characters.');
  if (password.length > 128) return fail('Your password must be at most 128 characters.');
  if (/^(.)\1+$/.test(password)) return fail('Please choose a less repetitive password.');
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return fail('That password is too common. Please choose another.');
  const local = String(email).split('@')[0].toLowerCase();
  if ((local.length >= 4 && lower.includes(local)) || (handle.length >= 4 && lower.includes(handle))) {
    return fail('Your password should not contain your email or handle.');
  }
  if (new Set(lower).size < 5) return fail('Please choose a less repetitive password.');
  return good(password);
}

const RESERVED_HANDLES = new Set([
  'admin', 'api', 'about', 'artists', 'artist', 'shop', 'login', 'logout', 'signup', 'join', 'dashboard',
  'privacy', 'terms', 'img', 'p', 'sell', 'support', 'help', 'oh-my-gogh', 'ohmygogh', 'gogh', 'root', 'static',
  'assets', 'css', 'js', 'fonts', 'new', 'null', 'undefined', 'www', 'mail', 'staff', 'team',
]);

export function slugify(input, max = 40) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

export function validateHandle(input) {
  if (typeof input !== 'string') return fail('Please choose a handle.');
  const h = input.trim().toLowerCase().replace(/^@/, '');
  if (h.length < 3 || h.length > 30) return fail('Your handle must be 3 to 30 characters.');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(h)) {
    return fail('Use only lowercase letters, numbers and single hyphens, starting and ending with a letter or number.');
  }
  if (RESERVED_HANDLES.has(h)) return fail('That handle is reserved. Please choose another.');
  return good(h);
}

export function handleFromName(name) {
  let base = slugify(name, 30);
  if (base.length < 3) base = (base + '-artist').slice(0, 30);
  if (RESERVED_HANDLES.has(base)) base += '-art';
  return base;
}

/** Free-form category, normalised to lowercase words. */
export function validateCategory(input, { required = true } = {}) {
  const t = cleanText(input, { min: required ? 1 : 0, max: 40, label: 'Category' });
  if (!t.ok) return t;
  const c = t.value.toLowerCase();
  if (c && !/^[\p{L}\p{N}][\p{L}\p{N} &'\-/]*$/u.test(c)) {
    return fail('Category can use letters, numbers, spaces and - & / only.');
  }
  return good(c);
}

export function validateTags(input) {
  if (input === undefined || input === null || input === '') return good([]);
  let list = input;
  if (typeof list === 'string') list = list.split(',');
  if (!Array.isArray(list)) return fail('Tags must be a list.');
  const out = [];
  for (const raw of list) {
    if (typeof raw !== 'string') return fail('Tags must be text.');
    const t = raw.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (t.length > 30) return fail('Each tag must be at most 30 characters.');
    if (!/^[\p{L}\p{N}][\p{L}\p{N} \-]*$/u.test(t)) return fail('Tags can use letters, numbers, spaces and hyphens only.');
    if (!out.includes(t)) out.push(t);
  }
  if (out.length > MAX_TAGS) return fail(`Use at most ${MAX_TAGS} tags.`);
  return good(out);
}

export function validateUrl(input) {
  if (typeof input !== 'string') return fail('Link must be a web address.');
  const s = input.trim();
  if (s.length > 300) return fail('Links must be at most 300 characters.');
  if (CONTROL_RE.test(s) || /\s/.test(s)) return fail('Link is not a valid web address.');
  let u;
  try {
    u = new URL(s);
  } catch {
    return fail('Links must start with https:// or http://');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return fail('Links must start with https:// or http://');
  if (u.username || u.password) return fail('Links cannot contain a username or password.');
  if (!u.hostname.includes('.')) return fail('Link is not a valid web address.');
  return good(u.toString());
}

export function validateLinks(input) {
  if (input === undefined || input === null) return good([]);
  if (!Array.isArray(input)) return fail('Links must be a list.');
  if (input.length > MAX_LINKS) return fail(`Add at most ${MAX_LINKS} links.`);
  const out = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') return fail('Each link needs a label and a web address.');
    if (!item.url && !item.label) continue; // ignore empty rows
    const label = cleanText(item.label, { min: 1, max: 30, label: 'Link label' });
    if (!label.ok) return label;
    const url = validateUrl(item.url);
    if (!url.ok) return url;
    out.push({ label: label.value, url: url.value });
  }
  return good(out);
}

/** Price given as a decimal string/number in major units. Returns minor units (integer). */
export function validatePrice(input, currency) {
  if (!CURRENCIES.includes(currency)) return fail(`Currency must be one of ${CURRENCIES.join(', ')}.`);
  let s = typeof input === 'number' ? String(input) : input;
  if (typeof s !== 'string') return fail('Please enter a price.');
  s = s.trim().replace(/,/g, '');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return fail('Price must be a number with at most 2 decimals, for example 1200 or 49.50.');
  const [whole, frac = ''] = s.split('.');
  const minor = parseInt(whole, 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
  if (minor < 100) return fail('Price must be at least 1.00.');
  if (minor > MAX_PRICE_MINOR) return fail('Price is too high.');
  return good(minor);
}

export function validateInt(input, { min, max, label }) {
  if (typeof input === 'string' && /^\d{1,9}$/.test(input.trim())) input = parseInt(input, 10);
  if (typeof input !== 'number' || !Number.isInteger(input)) return fail(`${label} must be a whole number.`);
  if (input < min || input > max) return fail(`${label} must be between ${min} and ${max}.`);
  return good(input);
}

export function validateProductInput(body, { partial = false } = {}) {
  const errors = {};
  const out = {};
  const need = (key) => !partial || body[key] !== undefined;

  if (need('title')) {
    const r = cleanText(body.title, { min: 3, max: 120, label: 'Title' });
    r.ok ? (out.title = r.value) : (errors.title = r.error);
  }
  if (need('description')) {
    const r = cleanText(body.description, { min: 0, max: 4000, multiline: true, label: 'Description' });
    r.ok ? (out.description = r.value) : (errors.description = r.error);
  }
  if (need('category')) {
    const r = validateCategory(body.category);
    r.ok ? (out.category = r.value) : (errors.category = r.error);
  }
  if (body.tags !== undefined || !partial) {
    const r = validateTags(body.tags);
    r.ok ? (out.tags = r.value) : (errors.tags = r.error);
  }
  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : body.currency;
  if (need('currency')) {
    if (!CURRENCIES.includes(currency)) errors.currency = `Currency must be one of ${CURRENCIES.join(', ')}.`;
    else out.currency = currency;
  }
  if (need('price')) {
    const r = validatePrice(body.price, out.currency || currency);
    r.ok ? (out.price_minor = r.value) : (errors.price = r.error);
  }
  if (need('stock')) {
    const r = validateInt(body.stock, { min: 0, max: MAX_STOCK, label: 'Stock' });
    r.ok ? (out.stock = r.value) : (errors.stock = r.error);
  }
  if (body.edition_size !== undefined || !partial) {
    if (body.edition_size === null || body.edition_size === '' || body.edition_size === undefined) out.edition_size = null;
    else {
      const r = validateInt(body.edition_size, { min: 1, max: MAX_STOCK, label: 'Edition size' });
      r.ok ? (out.edition_size = r.value) : (errors.edition_size = r.error);
    }
  }
  if (body.status !== undefined || !partial) {
    const s = body.status === undefined ? 'draft' : body.status;
    if (s !== 'draft' && s !== 'published') errors.status = 'Status must be draft or published.';
    else out.status = s;
  }
  if (out.edition_size != null && out.stock != null && out.stock > out.edition_size && !errors.stock && !errors.edition_size) {
    errors.stock = 'Stock cannot be more than the edition size.';
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: out };
}

export function validateProfileInput(body) {
  const errors = {};
  const out = {};
  const name = cleanText(body.name, { min: 2, max: 60, label: 'Name' });
  name.ok ? (out.name = name.value) : (errors.name = name.error);
  const bio = cleanText(body.bio, { min: 0, max: 1200, multiline: true, label: 'Bio' });
  bio.ok ? (out.bio = bio.value) : (errors.bio = bio.error);
  const loc = cleanText(body.location, { min: 0, max: 80, label: 'Location' });
  loc.ok ? (out.location = loc.value) : (errors.location = loc.error);
  const cat = validateCategory(body.category);
  cat.ok ? (out.category = cat.value) : (errors.category = cat.error);
  const tags = validateTags(body.tags);
  tags.ok ? (out.tags = tags.value) : (errors.tags = tags.error);
  const links = validateLinks(body.links);
  links.ok ? (out.links = links.value) : (errors.links = links.error);
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: out };
}
