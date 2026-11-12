const { deflateSync, Inflate } = require('fflate');

// v1 contains a raw DEFLATE stream of UTF-8 JSON: [epoch milliseconds, description, zone].
const COMPRESSED_EVENT = 'v1';
const MAX_EVENT_BYTES = 1024 * 1024;
const INVALID_COMPRESSED_EVENT = {
  kind: 'invalid',
  message: 'This compressed event link is invalid. Ask the organizer for a valid link, or create a new event.'
};

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
  if (values.length !== 1 || params.has('date') || encoded.length > Math.ceil(MAX_EVENT_BYTES * 4 / 3) ||
      !/^[A-Za-z0-9_-]+$/.test(encoded)) return INVALID_COMPRESSED_EVENT;

  try {
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
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
    return { kind: 'event', date, description, zone };
  } catch {
    return INVALID_COMPRESSED_EVENT;
  }
}

function decodeEvent(query) {
  const params = new URLSearchParams(query);
  if (params.has(COMPRESSED_EVENT)) return decodeCompressedEvent(params);
  if (!params.has('date')) return { kind: 'none' };
  const values = params.getAll('date');
  const date = values.length === 1 ? parseEventDate(values[0]) : null;
  if (!date) return { kind: 'invalid', message: 'This event link has an invalid date. Ask the organizer for a valid link, or create a new event.' };
  return { kind: 'event', date, description: params.get('desc') || '', zone: params.get('zone') || null };
}
function encodeEventUrl({ date, description = '', zone }, baseUrl, { compress = true } = {}) {
  if (!date || !Number.isFinite(date.getTime())) throw new Error('Select a valid event date and time.');
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('date', date.toISOString());
  url.searchParams.set('desc', description);
  if (zone) url.searchParams.set('zone', zone);
  const plainUrl = url.href;
  if (!compress) return plainUrl;

  const data = new TextEncoder().encode(JSON.stringify([
    date.getTime(), url.searchParams.get('desc'), url.searchParams.get('zone')
  ]));
  if (data.length > MAX_EVENT_BYTES) return plainUrl;

  const bytes = deflateSync(data, { level: 9 });
  if (bytes.length > MAX_EVENT_BYTES) return plainUrl;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  url.search = '?' + COMPRESSED_EVENT + '=' + encoded;
  return url.href.length < plainUrl.length ? url.href : plainUrl;
}
module.exports = { parseEventDate, decodeEvent, encodeEventUrl };
