const { Temporal } = require('@js-temporal/polyfill');
const MAX_TIME_ZONE_LENGTH = 128;
function isTimeZone(zone, intl = Intl) {
  if (typeof zone !== 'string' || zone.length > MAX_TIME_ZONE_LENGTH || (zone !== 'UTC' && !zone.includes('/'))) return false;
  try { new intl.DateTimeFormat('en', { timeZone: zone }); return true; } catch { return zone === 'UTC'; }
}
function detectTimeZone(intl = Intl) {
  try {
    const zone = new intl.DateTimeFormat().resolvedOptions().timeZone;
    return isTimeZone(zone, intl) ? zone : 'UTC';
  } catch { return 'UTC'; }
}
function supportedTimeZones(intl = Intl) {
  try { return [...new Set(['UTC', detectTimeZone(intl), ...intl.supportedValuesOf('timeZone')])].sort(); }
  catch {
    const fallbackZones = ['UTC', detectTimeZone(intl), 'America/New_York', 'Europe/London', 'Asia/Kolkata'];
    return [...new Set(fallbackZones)].filter(zone => isTimeZone(zone, intl));
  }
}
function resolveWallTime(wall, zone) {
  try {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?$/.test(wall) || !isTimeZone(zone))
      return { kind: 'invalid', choices: [] };
    const plain = Temporal.PlainDateTime.from(wall, { overflow: 'reject' });
    const earlier = plain.toZonedDateTime(zone, { disambiguation: 'earlier' });
    const later = plain.toZonedDateTime(zone, { disambiguation: 'later' });
    const possible = [earlier, later].filter(value => value.toPlainDateTime().equals(plain));
    const unique = possible.filter((value, i) => i === 0 || value.epochMilliseconds !== possible[0].epochMilliseconds);
    const choices = unique.map(value => ({
      date: new Date(value.epochMilliseconds), offset: value.offset,
      label: plain.toString({ smallestUnit: 'minute' }) + ' UTC' + value.offset + ' (' + zone + ')'
    }));
    return { kind: choices.length === 0 ? 'gap' : choices.length === 2 ? 'ambiguous' : 'valid', choices };
  } catch { return { kind: 'invalid', choices: [] }; }
}
module.exports = { MAX_TIME_ZONE_LENGTH, isTimeZone, detectTimeZone, supportedTimeZones, resolveWallTime };
