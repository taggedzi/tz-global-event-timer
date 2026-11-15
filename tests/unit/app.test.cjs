const { test } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { mount } = require('./helpers.cjs');
const { encodeProtectedEventUrl } = require('../../src/js/event-link');
for (const description of ['', 'Game night & friends 🎮\nBring a snack.']) {
  test('creates and opens description ' + JSON.stringify(description), t => {
    const creator = mount(); t.after(creator.close);
    creator.select(new Date('2026-01-02T01:02:00Z'));
    creator.document.getElementById('newEventDesc').value = description;
    creator.document.getElementById('create').click();
    const url = new URL(creator.document.getElementById('link').dataset.link);
    assert.equal(url.pathname, '/timer/');
    const viewer = mount(url.search); t.after(viewer.close);
    const displayedDescription = viewer.document.getElementById('eventDesc');
    assert.equal(displayedDescription.tagName, 'P');
    assert.equal(displayedDescription.textContent, description);
    assert.equal(displayedDescription.hidden, !description);
    assert.equal(viewer.document.getElementById('guestFallback').hidden, Boolean(description));
    assert.equal(Date.parse(viewer.document.getElementById('existingEventTime').dataset.instant), Date.parse('2026-01-02T01:02:00Z'));
    for (const tick of viewer.callbacks.values()) tick();
    for (const [id, value] of [['days', '1'], ['hours', '1'], ['minutes', '2']])
      assert.equal(viewer.document.getElementById(id).textContent, value);
  });
}
test('opens an already-started legacy event', t => {
  const viewer = mount('?date=Wed%2C+31+Dec+2025+23%3A00%3A00+GMT'); t.after(viewer.close);
  for (const tick of viewer.callbacks.values()) tick();
  assert.match(viewer.document.getElementById('existingEventHeader').textContent, /already started/);
  assert.equal(viewer.document.getElementById('countdown').style.display, 'none');
  assert.equal(viewer.callbacks.size, 0);
});

test('rejects a protected link by default, even if it also contains a public event', async t => {
  const date = new Date('2030-01-01T00:00:00Z');
  const url = new URL(await encodeProtectedEventUrl({ date }, 'https://example.test/timer/', {
    password: 'test password', crypto: webcrypto
  }));
  const viewer = mount('?date=' + date.toISOString() + url.hash); t.after(viewer.close);
  assert.match(viewer.document.getElementById('linkError').textContent, /site owner has disabled password protection/);
  assert.equal(viewer.document.querySelector('input[type="password"]'), null);
  assert.equal(viewer.document.getElementById('existingEventTime').dataset.instant, undefined);
  assert.equal(viewer.callbacks.size, 0);

  viewer.select(date);
  viewer.document.getElementById('create').click();
  const publicUrl = new URL(viewer.document.getElementById('link').dataset.link);
  assert.equal(publicUrl.hash, '');
  assert.ok(publicUrl.search);
});

test('renders the creator password field when password protection is enabled', t => {
  const creator = mount('', { passwordProtectionEnabled: true }); t.after(creator.close);
  assert.equal(creator.document.getElementById('linkPassword').type, 'password');
  assert.equal(creator.document.getElementById('unlockEventForm'), null);
});
