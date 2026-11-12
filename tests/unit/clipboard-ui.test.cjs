const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mount } = require('./helpers.cjs');
for (const mode of ['missing API', 'insecure context', 'synchronous exception', 'throwing API getter']) {
  test('manual recovery for ' + mode, async t => {
    const view = mount(); t.after(view.close);
    if (mode === 'insecure context') Object.defineProperty(view.window, 'isSecureContext', { value: false });
    if (mode === 'synchronous exception') Object.defineProperty(view.window.navigator, 'clipboard', { value: { writeText() { throw new Error('Failed'); } } });
    if (mode === 'throwing API getter') Object.defineProperty(view.window.navigator, 'clipboard', { get() { throw new Error('Unavailable'); } });
    view.select(new Date('2028-01-01T20:00:00Z'));
    view.document.getElementById('create').click();
    view.document.getElementById('copyUrl').click();
    await Promise.resolve(); await Promise.resolve();
    assert.match(view.document.getElementById('copyStatus').textContent, /manually/);
    assert.deepEqual(view.errors, []);
  });
}
test('a rejected copy shows recovery guidance instead of silent console output', async t => {
  const view = mount(); t.after(view.close);
  Object.defineProperty(view.window.navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Denied')) }, configurable: true });
  view.select(new Date('2028-01-01T20:00:00Z'));
  view.document.getElementById('create').click();
  view.document.getElementById('copyUrl').click();
  await Promise.resolve(); await Promise.resolve();
  assert.match(view.document.getElementById('copyStatus')?.textContent || '', /manually/i);
  assert.doesNotMatch(view.document.getElementById('copyStatus')?.textContent || '', /copied/i);
  const field = view.document.getElementById('shareUrl');
  assert.equal(view.document.activeElement, field);
  assert.equal(field.selectionStart, 0);
  assert.equal(field.selectionEnd, field.value.length);
});
