const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCopyController } = require('../../src/js/clipboard');
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => { resolve=yes; reject=no; }); return { promise, resolve, reject }; };
for (const failure of [() => { throw new Error('Missing API'); }, () => Promise.reject(new Error('Denied'))]) {
  test('sync and async clipboard failures produce manual recovery', async () => {
    const statuses = [];
    const copy = createCopyController({ getUrl: () => 'https://example.test/?desc=🎮', writeText: failure, onStatus: value => statuses.push(value) });
    await copy.copy();
    assert.equal(statuses.at(-1).kind, 'error');
    assert.match(statuses.at(-1).message, /manually/);
    assert.equal(statuses.some(value => value.kind === 'success'), false);
  });
}
test('success waits for the write and copies the exact URL', async () => {
  const pending = deferred(), statuses = [], received = [];
  const url = 'https://example.test/?desc=%F0%9F%8E%AE%26friends';
  const copy = createCopyController({ getUrl: () => url, writeText: value => { received.push(value); return pending.promise; }, onStatus: value => statuses.push(value) });
  const job = copy.copy();
  assert.equal(statuses.at(-1).kind, 'pending');
  pending.resolve(); await job;
  assert.equal(statuses.at(-1).kind, 'success');
  assert.deepEqual(received, [url]);
});
test('late results cannot overwrite a newer request or newly generated link', async () => {
  const first = deferred(), second = deferred(), statuses = [];
  let count = 0, url = 'https://example.test/old';
  const copy = createCopyController({ getUrl: () => url, writeText: () => (++count === 1 ? first.promise : second.promise), onStatus: value => statuses.push(value) });
  const oldJob = copy.copy(), newJob = copy.copy();
  second.resolve(); await newJob;
  first.reject(new Error('Late failure')); await oldJob;
  assert.equal(statuses.at(-1).kind, 'success');
  const third = deferred();
  const active = createCopyController({ getUrl: () => url, writeText: () => third.promise, onStatus: value => statuses.push(value) });
  const pending = active.copy();
  url = 'https://example.test/new'; active.invalidate();
  third.resolve(); await pending;
  assert.equal(statuses.at(-1).kind, 'idle');
});
test('missing URL and destroyed views never write or publish late results', async () => {
  let writes = 0;
  const inactive = createCopyController({ getUrl: () => undefined, writeText: () => writes++, onStatus() {} });
  await inactive.copy(); assert.equal(writes, 0);
  const pending = deferred(), statuses = [];
  const copy = createCopyController({ getUrl: () => 'https://example.test', writeText: () => pending.promise, onStatus: value => statuses.push(value) });
  const job = copy.copy(); copy.destroy(); pending.resolve(); await job;
  assert.equal(statuses.at(-1).kind, 'pending');
});
