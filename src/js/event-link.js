const { deflateSync, Inflate } = require('fflate');
const { MAX_TIME_ZONE_LENGTH } = require('./timezone');

// v1 contains a raw DEFLATE stream of UTF-8 JSON: [epoch milliseconds, description, zone].
const COMPRESSED_EVENT = 'v1';
const MAX_EVENT_BYTES = 1024 * 1024;
const MAX_DESCRIPTION_BYTES = 4096;
// Percent encoding can triple the description size. Leave room for the date and zone.
const MAX_QUERY_LENGTH = 13 * 1024;
// p1 contains a 16-byte salt, a 12-byte IV, and an AES-GCM ciphertext (including its 16-byte tag).
// Its plaintext is the existing event query. The prefix fixes the key derivation parameters.
const PROTECTED_EVENT = '#p1=';
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAX_PROTECTED_BYTES = SALT_BYTES + IV_BYTES + TAG_BYTES + MAX_QUERY_LENGTH;
const CRYPTO_UNAVAILABLE = 'Password protection requires a browser with Web Crypto on a secure connection.';
const DESCRIPTION_TOO_LONG = 'Shorten the event description to 4,096 bytes or less.';
const INVALID_COMPRESSED_EVENT = {
  kind: 'invalid',
  message: 'This compressed event link is invalid. Ask the organizer for a valid link, or create a new event.'
};

function descriptionByteLength(description) {
  return new TextEncoder().encode(description).length;
}

function descriptionFits(description) {
  return description.length <= MAX_DESCRIPTION_BYTES && descriptionByteLength(description) <= MAX_DESCRIPTION_BYTES;
}

function toBase64Url(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded) {
  return Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
}

function decodedEvent(date, description, zone) {
  if (!descriptionFits(description) || (zone !== null && zone.length > MAX_TIME_ZONE_LENGTH)) {
    return { kind: 'invalid', message: 'This event link has a description or timezone that is too long.' };
  }
  return { kind: 'event', date, description, zone };
}

const ISO = /^(\d{4}|[+-]\d{6})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const LEGACY = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/;
function parseEventDate(value) {
  if (typeof value !== 'string') return null;
  if (ISO.test(value)) {
    const date = new Date(value);
    const canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
    return Number.isFinite(date.getTime()) && date.toISOString() === canonical ? date : null;
  }
  const match = LEGACY.exec(value);
  if (!match) return null;
  const [, , day, month, year, hour, minute, second] = match;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const date = new Date(0);
  date.setUTCFullYear(Number(year), months.indexOf(month), Number(day));
  date.setUTCHours(Number(hour), Number(minute), Number(second), 0);
  return date.toUTCString() === value ? date : null;
}
function decodeCompressedEvent(params) {
  const values = params.getAll(COMPRESSED_EVENT);
  const encoded = values[0];
  if (values.length !== 1 || params.has('date') ||
      !/^[A-Za-z0-9_-]+$/.test(encoded)) return INVALID_COMPRESSED_EVENT;

  try {
    const bytes = fromBase64Url(encoded);
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let length = 0;
    let json = '';
    const inflate = new Inflate((chunk, final) => {
      length += chunk.length;
      if (length > MAX_EVENT_BYTES) throw new Error('Event data is too large.');
      json += decoder.decode(chunk, { stream: !final });
    });
    // Feed small chunks so highly compressed input cannot allocate a huge output buffer in one push.
    for (let offset = 0; offset < bytes.length; offset += 1024) {
      inflate.push(bytes.subarray(offset, offset + 1024), offset + 1024 >= bytes.length);
    }
    const data = JSON.parse(json);
    if (!Array.isArray(data) || data.length !== 3) return INVALID_COMPRESSED_EVENT;
    const [timestamp, description, zone] = data;
    const date = new Date(timestamp);
    if (!Number.isSafeInteger(timestamp) || !Number.isFinite(date.getTime()) ||
        typeof description !== 'string' || (zone !== null && typeof zone !== 'string')) return INVALID_COMPRESSED_EVENT;
    return decodedEvent(date, description, zone);
  } catch {
    return INVALID_COMPRESSED_EVENT;
  }
}

function decodeEvent(query) {
  if (query?.length > MAX_QUERY_LENGTH) return { kind: 'invalid', message: 'This event link is too long.' };
  const params = new URLSearchParams(query);
  if (params.has(COMPRESSED_EVENT)) return decodeCompressedEvent(params);
  if (!params.has('date')) return { kind: 'none' };
  const values = params.getAll('date');
  const date = values.length === 1 ? parseEventDate(values[0]) : null;
  if (!date) return { kind: 'invalid', message: 'This event link has an invalid date. Ask the organizer for a valid link, or create a new event.' };
  return decodedEvent(date, params.get('desc') || '', params.get('zone') || null);
}
function encodeEventUrl({ date, description = '', zone }, baseUrl, { compress = true } = {}) {
  if (!date || !Number.isFinite(date.getTime())) throw new Error('Select a valid event date and time.');
  description = String(description);
  if (!descriptionFits(description)) throw new RangeError(DESCRIPTION_TOO_LONG);
  if (zone && String(zone).length > MAX_TIME_ZONE_LENGTH) throw new RangeError('Shorten the event timezone.');
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('date', date.toISOString());
  url.searchParams.set('desc', description);
  if (zone) url.searchParams.set('zone', zone);
  if (url.search.length > MAX_QUERY_LENGTH) throw new RangeError('Shorten the event link.');
  const plainUrl = url.href;
  if (!compress) return plainUrl;

  const data = new TextEncoder().encode(JSON.stringify([
    date.getTime(), url.searchParams.get('desc'), url.searchParams.get('zone')
  ]));
  if (data.length > MAX_EVENT_BYTES) return plainUrl;

  const bytes = deflateSync(data, { level: 9 });
  if (bytes.length > MAX_EVENT_BYTES) return plainUrl;
  url.search = '?' + COMPRESSED_EVENT + '=' + toBase64Url(bytes);
  return url.href.length < plainUrl.length ? url.href : plainUrl;
}

function isProtectedEventLink(hash) {
  return hash.startsWith(PROTECTED_EVENT);
}

function readProtectedEventLink(hash) {
  const encoded = hash.slice(PROTECTED_EVENT.length);
  if (encoded.length > Math.ceil(MAX_PROTECTED_BYTES * 4 / 3) || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const bytes = fromBase64Url(encoded);
    const headerBytes = SALT_BYTES + IV_BYTES;
    if (bytes.length <= headerBytes + TAG_BYTES || bytes.length > MAX_PROTECTED_BYTES ||
        toBase64Url(bytes) !== encoded) return null;
    return {
      salt: bytes.subarray(0, SALT_BYTES),
      iv: bytes.subarray(SALT_BYTES, headerBytes),
      ciphertext: bytes.subarray(headerBytes)
    };
  } catch {
    return null;
  }
}

async function deriveEventKey(crypto, password, salt, usage) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600_000 },
    material, { name: 'AES-GCM', length: 256 }, false, [usage]
  );
}

async function encodeProtectedEventUrl(event, baseUrl, { compress, password, crypto }) {
  const url = new URL(encodeEventUrl(event, baseUrl, { compress }));
  const plaintext = new TextEncoder().encode(url.search);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveEventKey(crypto, password, salt, 'encrypt');
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  const bytes = new Uint8Array(salt.length + iv.length + ciphertext.length);
  bytes.set(salt);
  bytes.set(iv, salt.length);
  bytes.set(ciphertext, salt.length + iv.length);
  url.search = '';
  url.hash = PROTECTED_EVENT + toBase64Url(bytes);
  return url.href;
}

async function unlockEvent({ salt, iv, ciphertext }, password, crypto) {
  const key = await deriveEventKey(crypto, password, salt, 'decrypt');
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return decodeEvent(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
}

module.exports = {
  MAX_DESCRIPTION_BYTES, DESCRIPTION_TOO_LONG, CRYPTO_UNAVAILABLE, descriptionByteLength, descriptionFits,
  parseEventDate, decodeEvent, encodeEventUrl, isProtectedEventLink, readProtectedEventLink, encodeProtectedEventUrl, unlockEvent
};
