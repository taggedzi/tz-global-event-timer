const { test } = require('node:test');
const assert = require('node:assert/strict');
const { main } = require('../../scripts/release-run.cjs');
test('release CLI rejects automatic events and non-GitHub execution before network access', async () => {
  for (const env of [{}, { GITHUB_ACTIONS:'true', GITHUB_EVENT_NAME:'push' }])
    await assert.rejects(main({ env, command:'publish', clientFactory() { throw new Error('Network must not be reached'); } }), /manually dispatched/);
});
test('release CLI rejects a run that does not match the selected source commit', async () => {
  const env = { GITHUB_ACTIONS:'true', GITHUB_EVENT_NAME:'workflow_dispatch', GITHUB_RUN_ID:'123',
    GITHUB_RUN_NUMBER:'42', GITHUB_SHA:'a'.repeat(40), GITHUB_REPOSITORY:'owner/timer' };
  await assert.rejects(main({ env, command:'prepare', clientFactory: () => ({
    async getRun() { return { id:123,run_number:42,event:'workflow_dispatch',head_sha:'b'.repeat(40) }; }
  }) }), /does not match/);
});
