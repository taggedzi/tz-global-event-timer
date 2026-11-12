const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mount } = require('./helpers.cjs');
const query = '?' + new URLSearchParams({ date: '2026-12-31T23:30:00.000Z', zone: 'Europe/London' });
test('selecting a display zone preserves the instant and timer', t => {
  const view = mount(query); t.after(view.close);
  const el = id => view.document.getElementById(id);
  const timers = view.callbacks.size;
  const instant = el('existingEventTime').dataset.instant;
  const dropdown = el('viewerZone');
  const localZone = dropdown.value;
  const localTime = el('existingEventTime').textContent;
  assert.equal(dropdown.tagName, 'SELECT');
  assert.equal(dropdown.selectedOptions[0].textContent, `Your local time (${localZone})`);
  dropdown.value = 'Asia/Tokyo';
  dropdown.dispatchEvent(new view.window.Event('change'));
  assert.match(el('existingEventTime').textContent, /2027/);
  assert.match(el('existingEventTime').textContent, /Asia\/Tokyo/);
  assert.equal(el('existingEventTime').dataset.instant, instant);
  assert.equal(view.callbacks.size, timers);
  dropdown.value = localZone;
  dropdown.dispatchEvent(new view.window.Event('change'));
  assert.equal(el('existingEventTime').textContent, localTime);
  assert.match(el('originEventTime').textContent, /Europe\/London/);
});
test('failed Intl detection/formatting falls back to labeled UTC', t => {
  const view = mount(query, { intl: { DateTimeFormat() { throw new Error('Unavailable'); } } }); t.after(view.close);
  assert.equal(view.document.getElementById('viewerZone').value, 'UTC');
  assert.equal(view.document.getElementById('viewerZone').options.length, 1);
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
