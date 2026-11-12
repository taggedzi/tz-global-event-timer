const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mount } = require('./helpers.cjs');
const { countdownState } = require('../../src/js/countdown');
const { initializeApp } = require('../../src/js/app');
const query = '?date=2026-01-01T00:00:00.000Z';
const text = (view,id) => view.document.getElementById(id).textContent;
const tick = view => { for (const callback of [...view.callbacks.values()]) callback(); };
test('already-started event renders immediately and creates no interval', t => {
  const view = mount(query); t.after(view.close);
  assert.match(text(view,'existingEventHeader'), /already started/);
  assert.equal(view.callbacks.size, 0);
  assert.equal(view.document.getElementById('countdown').style.display, 'none');
});
test('one millisecond before start stays future; exact zero stops the interval', t => {
  const view = mount('?date=2026-01-01T00:00:00.001Z'); t.after(view.close);
  assert.equal(text(view,'seconds'), '1');
  view.setNow('2026-01-01T00:00:00.001Z'); tick(view);
  assert.match(text(view,'existingEventHeader'), /already started/);
  assert.equal(view.callbacks.size, 0);
  view.setNow('2026-01-01T00:00:00.002Z');
  view.window.dispatchEvent(new view.window.Event('focus'));
  assert.equal(view.callbacks.size, 0);
});
test('delayed ticks and focus/visibility refresh use the absolute clock', t => {
  const view = mount('?date=2026-01-02T01:02:03.000Z'); t.after(view.close);
  view.setNow('2026-01-02T01:02:02.999Z'); tick(view);
  assert.equal(text(view,'days'), '0'); assert.equal(text(view,'seconds'), '1');
  view.setNow('2026-01-03T00:00:00Z');
  view.document.dispatchEvent(new view.window.Event('visibilitychange'));
  assert.match(text(view,'existingEventHeader'), /already started/);
  assert.equal(view.callbacks.size, 0);
  view.setNow('2026-01-01T00:00:00Z');
  view.window.dispatchEvent(new view.window.Event('focus'));
  assert.equal(text(view,'days'), '1'); assert.equal(text(view,'hours'), '1');
  assert.equal(view.callbacks.size, 1);
  view.window.dispatchEvent(new view.window.Event('focus'));
  assert.equal(view.callbacks.size, 1);
});
test('destroy and reinitialize release timers and event listeners', t => {
  const view = mount('?date=2026-01-02T00:00:00Z'); t.after(view.close);
  const optionCount = view.document.getElementById('timeZones').children.length;
  let id = 100;
  const replacement = initializeApp({ window: view.window, now: () => Date.parse('2026-01-01T00:00:00Z'),
    setInterval(fn) { view.callbacks.set(++id, fn); return id; },
    clearInterval(timer) { view.callbacks.delete(timer); } });
  t.after(() => replacement.destroy());
  assert.equal(view.callbacks.size, 1);
  assert.equal(view.document.getElementById('timeZones').children.length, optionCount);
  view.app.destroy();
  replacement.destroy();
  assert.equal(view.callbacks.size, 0);
  view.document.getElementById('create').click();
  assert.equal(text(view,'formError'), '');
  view.window.dispatchEvent(new view.window.Event('focus'));
  assert.equal(view.callbacks.size, 0);
});

for (const [remaining, parts] of [[1,[0,0,0,1]],[1000,[0,0,0,1]],[1001,[0,0,0,2]],
  [59999,[0,0,1,0]],[60000,[0,0,1,0]],[60001,[0,0,1,1]],
  [3599999,[0,1,0,0]],[3600001,[0,1,0,1]],[86399999,[1,0,0,0]],
  [86400001,[1,0,0,1]],[172861001,[2,0,1,2]]]) {
  test('countdown rollover at ' + remaining + 'ms', () => {
    const state = countdownState(remaining, 0);
    assert.equal(state.started, false);
    assert.deepEqual([state.days,state.hours,state.minutes,state.seconds], parts);
  });
}
test('invalid timestamps cannot produce a NaN countdown', () => {
  assert.throws(() => countdownState(NaN, 0), /finite/);
  assert.throws(() => countdownState(0, Infinity), /finite/);
});
