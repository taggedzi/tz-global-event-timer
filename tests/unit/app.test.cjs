const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');
const { initializeApp } = require('../../src/js/app');

process.env.TZ = 'UTC';
const html = readFileSync('src/index.html', 'utf8');
function mount(query = '') {
  const dom = new JSDOM(html, { url: `https://example.test/timer/${query}` });
  const callbacks = new Map();
  let nextId = 0;
  initializeApp({ window: dom.window, flatpickr() {}, now: () => Date.parse('2026-01-01T00:00:00Z'),
    setInterval(fn) { callbacks.set(++nextId, fn); return nextId; }, clearInterval(id) { callbacks.delete(id); } });
  return { document: dom.window.document, callbacks, close: () => dom.window.close() };
}

for (const description of ['', 'Game night & friends 🎮']) {
  test(`creates and opens a link with description ${JSON.stringify(description)}`, () => {
    const creator = mount();
    creator.document.getElementById('newEvent').value = '2026-01-02 01:02';
    creator.document.getElementById('newEventDesc').value = description;
    creator.document.getElementById('create').click();
    const url = new URL(creator.document.getElementById('link').dataset.link);
    assert.equal(url.pathname, '/timer/');
    assert.equal(Date.parse(url.searchParams.get('date')), Date.parse('2026-01-02T01:02:00Z'));
    const viewer = mount(url.search);
    assert.equal(viewer.document.getElementById('eventDesc').innerText, description);
    assert.equal(Date.parse(viewer.document.getElementById('existingEventTime').innerText), Date.parse('2026-01-02T01:02:00Z'));
    for (const tick of viewer.callbacks.values()) tick();
    assert.equal(viewer.document.getElementById('days').innerText, 1);
    assert.equal(viewer.document.getElementById('hours').innerText, 1);
    assert.equal(viewer.document.getElementById('minutes').innerText, 2);
    creator.close(); viewer.close();
  });
}
test('opens an already-started legacy event', () => {
  const viewer = mount('?date=Wed%2C+31+Dec+2025+23%3A00%3A00+GMT');
  for (const tick of viewer.callbacks.values()) tick();
  assert.match(viewer.document.getElementById('existingEventHeader').innerText, /already started/);
  assert.equal(viewer.document.getElementById('countdown').style.display, 'none');
  assert.equal(viewer.callbacks.size, 0);
  viewer.close();
});
