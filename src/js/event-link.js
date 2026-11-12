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
function decodeEvent(query) {
  const params = new URLSearchParams(query);
  if (!params.has('date')) return { kind: 'none' };
  const values = params.getAll('date');
  const date = values.length === 1 ? parseEventDate(values[0]) : null;
  if (!date) return { kind: 'invalid', message: 'This event link has an invalid date. Ask the organizer for a valid link, or create a new event.' };
  return { kind: 'event', date, description: params.get('desc') || '', zone: params.get('zone') || null };
}
function encodeEventUrl({ date, description = '', zone }, baseUrl) {
  if (!date || !Number.isFinite(date.getTime())) throw new Error('Select a valid event date and time.');
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('date', date.toISOString());
  url.searchParams.set('desc', description);
  if (zone) url.searchParams.set('zone', zone);
  return url.href;
}
module.exports = { parseEventDate, decodeEvent, encodeEventUrl };
