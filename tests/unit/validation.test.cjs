const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mount } = require('./helpers.cjs');
const { decodeEvent } = require('../../src/js/event-link');
for (const query of ['?date=not-a-date', '?date=', '?date=2026-02-30T00:00:00Z', '?date=2026-01-01T00:00:00Z&date=2027-01-01T00:00:00Z']) {
  test('bad link is recoverable: ' + query, t => {
    const view = mount(query); t.after(view.close);
    assert.equal(view.callbacks.size, 0);
    assert.match(view.document.getElementById('linkError')?.textContent || '', /invalid|valid/i);
    assert.equal(view.document.getElementById('existingEventTimer').style.display, '');
    assert.deepEqual(view.errors, []);
  });
}
test('tracking-only query does not start a timer', t => {
  const view = mount('?utm_source=chat'); t.after(view.close);
  assert.equal(view.callbacks.size, 0);
});
test('empty submission gives an inline explanation, no exception or link', t => {
  const view = mount(); t.after(view.close);
  view.document.getElementById('create').click();
  assert.deepEqual(view.errors, []);
  assert.match(view.document.getElementById('formError')?.textContent || '', /select/i);
  assert.equal(view.document.getElementById('link').dataset.link, undefined);
});
test('creation uses timezone-free calendar input and safely round-trips text', t => {
  const view = mount(); t.after(view.close);
  const instant = new Date('2028-02-29T12:34:00Z');
  view.select(instant);
  const description = '<img src=x onerror=alert(1)> & "quotes"\n🎮';
  view.document.getElementById('newEventDesc').value = description;
  // A text input normalizes newlines; URL model tests cover multi-line descriptions separately.
  const normalized = view.document.getElementById('newEventDesc').value;
  view.document.getElementById('create').click();
  const link = new URL(view.document.getElementById('link').dataset.link);
  const event = decodeEvent(link.search);
  assert.equal(event.date.toISOString(), instant.toISOString());
  assert.equal(event.description, normalized);
  assert.equal(view.document.querySelectorAll('#link a').length, 1);
  assert.equal(view.document.querySelectorAll('#link img').length, 0);
});

test('oversized descriptions show an inline error and allow correction', t => {
  const view = mount(); t.after(view.close);
  view.select(new Date('2028-02-29T12:34:00Z'));
  const description = view.document.getElementById('newEventDesc');
  description.value = '🎮'.repeat(1025);
  view.document.getElementById('create').click();
  assert.match(view.document.getElementById('formError').textContent, /description/i);
  assert.equal(view.document.activeElement, description);
  assert.equal(view.document.getElementById('link').dataset.link, undefined);
  assert.deepEqual(view.errors, []);

  description.value = 'Game night';
  description.dispatchEvent(new view.window.Event('input'));
  view.document.getElementById('create').click();
  assert.ok(view.document.getElementById('link').dataset.link);
  assert.equal(view.document.getElementById('formError').textContent, '');
});
