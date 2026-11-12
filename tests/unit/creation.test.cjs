const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mount } = require('./helpers.cjs');
const { detectTimeZone, supportedTimeZones } = require('../../src/js/timezone');

test('unavailable browser timezone detection falls back to an explicit UTC choice', () => {
  const brokenIntl = { DateTimeFormat() { throw new Error('Unavailable'); } };
  assert.equal(detectTimeZone(brokenIntl), 'UTC');
  assert.ok(supportedTimeZones(brokenIntl).includes('UTC'));
});

test('changing date or zone discards prior occurrence and generated link', t => {
  const view = mount(); t.after(view.close);
  const el = id => view.document.getElementById(id);
  for (const field of ['newEvent', 'eventZone']) {
    el('newEvent').value = '2026-11-01T01:30';
    el('eventZone').value = 'America/New_York';
    el('create').click();
    assert.match(el('formError').textContent, /twice/);
    el('occurrence').value = '0';
    el('create').click();
    assert.ok(el('link').dataset.link);
    el(field).dispatchEvent(new view.window.Event('input'));
    assert.equal(el('link').dataset.link, undefined);
    assert.equal(el('eventPreview').textContent, '');
    assert.equal(el('occurrence').options.length, 0);
    el('create').click();
    assert.match(el('formError').textContent, /twice/);
    el('newEvent').dispatchEvent(new view.window.Event('input'));
  }
});
