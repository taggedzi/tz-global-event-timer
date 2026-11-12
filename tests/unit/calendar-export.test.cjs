const { test } = require('node:test');
const assert = require('node:assert/strict');
const { serializeCalendarEvent } = require('../../src/js/calendar-export');

const date = new Date('2028-01-01T20:00:12.987Z');
const exportedAt = new Date('2027-12-01T05:06:07.123Z');
const uid = 'ab961648-9782-4dc1-b180-fc85aa7311e8';

test('writes one UTC event without an end time or a blank description', () => {
  const calendar = serializeCalendarEvent({ date, description: ' \t\n' }, { exportedAt, uid });
  const lines = calendar.split('\r\n');
  assert.deepEqual(lines, [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tz Global Event Timer//Calendar Export//EN',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:20271201T050607Z',
    'DTSTART:20280101T200012Z',
    'SUMMARY:Event',
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ]);
});

test('escapes description text and folds UTF-8 lines without splitting characters', () => {
  const description = '  Café, game; night\\snacks\r\nEND:VEVENT\rATTENDEE:someone\n' +
    'x'.repeat(57) + '🎮'.repeat(30) + '\0 ';
  const calendar = serializeCalendarEvent({ date, description }, { exportedAt, uid });
  const lines = calendar.split('\r\n');
  assert.ok(lines.some(line => line.startsWith(' ')));
  for (const line of lines) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
    assert.doesNotMatch(line, /[\r\n]/);
  }
  const unfolded = calendar.replace(/\r\n /g, '').split('\r\n');
  assert.equal(unfolded.filter(line => line === 'END:VEVENT').length, 1);
  assert.equal(unfolded.find(line => line.startsWith('DESCRIPTION:')),
    'DESCRIPTION:  Café\\, game\\; night\\\\snacks\\nEND:VEVENT\\nATTENDEE:someone\\n' +
    'x'.repeat(57) + '🎮'.repeat(30) + '\uFFFD ');
});

test('rejects an extended year that iCalendar cannot represent', () => {
  assert.throws(() => serializeCalendarEvent({
    date: new Date('+010000-01-01T00:00:00Z'), description: ''
  }, { exportedAt, uid }), RangeError);
});
