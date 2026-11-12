function formatEventTime(date, zone, intl = Intl, locale) {
  try {
    const text = new intl.DateTimeFormat(locale, { timeZone: zone, year: 'numeric',
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
      second: '2-digit', timeZoneName: 'longOffset' }).format(date);
    return text + ' (' + zone + ')';
  } catch {
    return date.toISOString().replace('T', ' ').replace('Z', ' UTC') + ' (UTC fallback)';
  }
}
module.exports = { formatEventTime };
