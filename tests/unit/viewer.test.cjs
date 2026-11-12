const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mount } = require('./helpers.cjs');
const query = '?' + new URLSearchParams({ date: '2026-12-31T23:30:00.000Z', zone: 'Europe/London' });
test('manual display override preserves the instant and timer; invalid zone preserves the display', t => {
  const view = mount(query); t.after(view.close);
  const el = id => view.document.getElementById(id);
  const timers = view.callbacks.size;
  const instant = el('existingEventTime').dataset.instant;
  el('viewerZone').value = 'Asia/Kolkata';
  el('viewerZone').dispatchEvent(new view.window.Event('change'));
  assert.match(el('existingEventTime').textContent, /2027/);
  assert.match(el('existingEventTime').textContent, /Asia\/Kolkata/);
  assert.equal(el('existingEventTime').dataset.instant, instant);
  assert.equal(view.callbacks.size, timers);
  const lastDisplay = el('existingEventTime').textContent;
  el('viewerZone').value = 'Not/AZone';
  el('viewerZone').dispatchEvent(new view.window.Event('change'));
  assert.match(el('viewerZoneError').textContent, /valid/);
  assert.equal(el('existingEventTime').textContent, lastDisplay);
  assert.match(el('originEventTime').textContent, /Europe\/London/);
});
test('failed Intl detection/formatting falls back to labeled UTC', t => {
  const view = mount(query, { intl: { DateTimeFormat() { throw new Error('Unavailable'); } } }); t.after(view.close);
  assert.equal(view.document.getElementById('viewerZone').value, 'UTC');
  assert.match(view.document.getElementById('existingEventTime').textContent, /UTC/);
  assert.match(view.document.getElementById('existingEventTime').textContent, /fallback/);
  assert.deepEqual(view.errors, []);
});
for (const zone of ['', 'Invalid/Zone', '<img src=x>']) {
  test('invalid optional origin zone cannot break a valid event: ' + zone, t => {
    const view = mount('?' + new URLSearchParams({ date: '2026-01-01T00:00:00Z', zone })); t.after(view.close);
    assert.equal(view.document.getElementById('existingEventTime').dataset.instant, '2026-01-01T00:00:00.000Z');
    assert.equal(view.document.getElementById('originEventTime').textContent, '');
    assert.deepEqual(view.errors, []);
  });
}
