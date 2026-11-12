const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { deflateSync } = require('fflate');
const { parseEventDate, encodeEventUrl, decodeEvent } = require('../../src/js/event-link');
for (const input of ['2028-02-29T12:34:56Z','2026-01-01T00:00:00.123Z','0000-01-01T00:00:00Z','+010000-01-01T00:00:00.000Z','Fri, 02 Jan 2026 01:02:00 GMT']) {
  test('accepts unambiguous date ' + input, () => assert.ok(parseEventDate(input)));
}
for (const input of ['',null,'2026-01-01','2026-01-01 20:00','2026-02-29T00:00:00Z','2026-02-30T00:00:00Z','2026-13-01T00:00:00Z','2026-01-01T24:00:00Z','2026-01-01T00:60:00Z','2026-01-01T00:00:60Z','+999999-01-01T00:00:00.000Z','Thu, 30 Feb 2026 00:00:00 GMT','Thu, 02 Jan 2026 01:02:00 GMT']) {
  test('rejects malformed date ' + input, () => assert.equal(parseEventDate(input), null));
}
test('round-trips text without carrying unrelated parameters or fragments', () => {
  const description = '<script>alert(1)</script> & "quotes"\n🎮';
  const date = new Date('2028-02-29T00:00:00Z');
  const url = new URL(encodeEventUrl({ date, description }, 'https://example.test/sub/path/?utm_source=chat#fragment'));
  assert.equal(url.pathname, '/sub/path/');
  assert.equal(url.hash, '');
  assert.equal(url.searchParams.has('utm_source'), false);
  const result = decodeEvent(url.search);
  assert.equal(result.date.getTime(), date.getTime());
  assert.equal(result.description, description);
  assert.equal(decodeEvent('?date=2026-01-01T00:00:00Z').description, '');
  assert.equal(decodeEvent('?desc=title').kind, 'none');
  assert.throws(() => encodeEventUrl({ date: new Date('bad') }, url.href), /valid/);
});

test('uses the existing format when compression would make a link longer', () => {
  const event = {
    date: new Date('2028-02-29T12:34:56.789Z'),
    description: createHash('shake256', { outputLength: 1024 }).update('event').digest('base64url')
  };
  const base = 'https://example.test/';
  assert.equal(encodeEventUrl(event, base), encodeEventUrl(event, base, { compress: false }));
});

test('rejects malformed, ambiguous, and oversized compressed event data', () => {
  const payload = json => Buffer.from(deflateSync(new TextEncoder().encode(json))).toString('base64url');
  const valid = payload('[0,"event","UTC"]');
  const oversized = payload(JSON.stringify([0, 'a'.repeat(1024 * 1024), null]));
  for (const query of [
    '?v1=', '?v1=invalid!', '?v1=' + valid.slice(0, -4),
    '?v1=' + valid + '&v1=' + valid, '?v1=' + valid + '&date=2028-01-01T00:00:00Z',
    '?v1=' + payload('["0","event","UTC"]'), '?v1=' + oversized
  ]) {
    assert.equal(decodeEvent(query).kind, 'invalid');
  }
});
