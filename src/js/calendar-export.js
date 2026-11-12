const encoder = new TextEncoder();

function formatCalendarDate(date) {
  const iso = date.toISOString();
  if (iso.length !== 24) throw new RangeError('Calendar files require a four-digit year.');
  return iso.slice(0, 19).replace(/[-:]/g, '') + 'Z';
}

function escapeCalendarText(text) {
  return text.toWellFormed()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '\uFFFD')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n?|\n/g, '\\n')
    .replace(/[;,]/g, '\\$&');
}

function foldCalendarLine(line) {
  let folded = '';
  let bytes = 0;
  for (const character of line) {
    const width = encoder.encode(character).length;
    if (bytes + width > 75) {
      folded += '\r\n ';
      bytes = 1;
    }
    folded += character;
    bytes += width;
  }
  return folded;
}

function serializeCalendarEvent({ date, description }, { exportedAt, uid }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tz Global Event Timer//Calendar Export//EN',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + formatCalendarDate(exportedAt),
    'DTSTART:' + formatCalendarDate(date),
    'SUMMARY:Event'
  ];
  if (description.trim()) lines.push('DESCRIPTION:' + escapeCalendarText(description));
  lines.push('END:VEVENT', 'END:VCALENDAR', '');
  return lines.map(foldCalendarLine).join('\r\n');
}

module.exports = { serializeCalendarEvent };
