const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mount } = require('./helpers.cjs');
for (const description of ['', 'Game night & friends 🎮']) {
  test('creates and opens description ' + JSON.stringify(description), t => {
    const creator = mount(); t.after(creator.close);
    creator.select(new Date('2026-01-02T01:02:00Z'));
    creator.document.getElementById('newEventDesc').value = description;
    creator.document.getElementById('create').click();
    const url = new URL(creator.document.getElementById('link').dataset.link);
    assert.equal(url.pathname, '/timer/');
    const viewer = mount(url.search); t.after(viewer.close);
    assert.equal(viewer.document.getElementById('eventDesc').textContent, description);
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
