const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveWallTime } = require('../../src/js/timezone');
const cases = [
  ['2026-01-02T20:00', 'Europe/London', '2026-01-02T20:00:00.000Z'],
  ['2026-07-02T20:00', 'Europe/London', '2026-07-02T19:00:00.000Z'],
  ['2026-01-02T20:00', 'America/New_York', '2026-01-03T01:00:00.000Z'],
  ['2026-07-02T20:00', 'America/New_York', '2026-07-03T00:00:00.000Z'],
  ['2026-01-02T20:00', 'Asia/Kolkata', '2026-01-02T14:30:00.000Z'],
  ['2026-01-02T20:00', 'Asia/Kathmandu', '2026-01-02T14:15:00.000Z'],
  ['2028-02-29T12:00', 'UTC', '2028-02-29T12:00:00.000Z']
];
for (const [wall, zone, expected] of cases) {
  test(wall + ' in ' + zone, () => {
    for (const deviceZone of ['UTC', 'America/New_York', 'Asia/Tokyo']) {
      process.env.TZ = deviceZone;
      const result = resolveWallTime(wall, zone);
      assert.equal(result.kind, 'valid');
      assert.equal(result.choices[0].date.toISOString(), expected);
    }
    process.env.TZ = 'UTC';
  });
}
for (const [wall, zone] of [['2026-03-08T02:30','America/New_York'], ['2026-10-04T02:15','Australia/Lord_Howe']]) {
  test('rejects gap ' + wall + ' ' + zone, () => assert.equal(resolveWallTime(wall, zone).kind, 'gap'));
}
for (const [wall, zone, difference] of [['2026-11-01T01:30','America/New_York',3600000], ['2026-04-05T01:45','Australia/Lord_Howe',1800000]]) {
  test('offers both repeated times ' + zone, () => {
    const result = resolveWallTime(wall, zone);
    assert.equal(result.kind, 'ambiguous');
    assert.equal(result.choices.length, 2);
    assert.equal(result.choices[1].date - result.choices[0].date, difference);
    assert.notEqual(result.choices[0].offset, result.choices[1].offset);
  });
}
for (const [wall, zone] of [['2026-02-29T12:00','UTC'],['2026-13-01T00:00','UTC'],['bad','UTC'],['2026-01-01T00:00','Not/AZone'],['2026-01-01T00:00','+02:00']]) {
  test('rejects invalid wall time or zone ' + wall + ' ' + zone, () => assert.equal(resolveWallTime(wall, zone).kind, 'invalid'));
}
