const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGitHubClient } = require('../../scripts/github-release.cjs');
const response = (status,body) => ({ status, ok: status >= 200 && status < 300, async json() { return body; } });
test('GitHub transport distinguishes missing resources from permission failures', async () => {
  const calls = [];
  const client = createGitHubClient({ repository: 'owner/timer', token: 'test-token',
    async fetch(url,options) { calls.push({url,options}); return response(404,{}); } });
  assert.equal(await client.latestRelease(), null);
  assert.equal(await client.getTagCommit('v2026.11.12.42'), null);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
  const denied = createGitHubClient({ repository: 'owner/timer', token: 'test-token', async fetch() { return response(403,{}); } });
  await assert.rejects(denied.latestRelease(), /403/);
});
test('release lookup includes drafts across pagination and annotated tags resolve to commits', async () => {
  const client = createGitHubClient({ repository: 'owner/timer', token: 'test-token',
    async fetch(url) {
      if (new URL(url).searchParams.get('page') === '1') return response(200, Array.from({length:100},(_,i) => ({ tag_name: 'old-' + i })));
      if (new URL(url).searchParams.get('page') === '2') return response(200,[{ tag_name: 'wanted', draft: true }]);
      if (url.includes('git/ref/')) return response(200,{object:{type:'tag',sha:'annotated'}});
      return response(200,{object:{type:'commit',sha:'a'.repeat(40)}});
    } });
  assert.equal((await client.findRelease('wanted')).draft, true);
  assert.equal(await client.getTagCommit('wanted'), 'a'.repeat(40));
});
test('uploads use the fixed GitHub upload host and drafts remain explicit', async () => {
  const calls = [];
  const client = createGitHubClient({ repository: 'owner/timer', token: 'test-token',
    async fetch(url,options) { calls.push({url,options}); return response(options.method === 'DELETE' ? 204 : 200,{}); } });
  await client.createDraft({tag_name:'version',target_commitish:'a'.repeat(40)});
  assert.equal(JSON.parse(calls[0].options.body).draft,true);
  const bytes = Buffer.from('zip');
  await client.uploadAsset(1,'release.zip',bytes,'application/zip');
  assert.ok(calls[1].url.startsWith('https://uploads.github.com/repos/owner/timer/'));
  assert.equal(calls[1].options.body,bytes);
  await client.deleteAsset(2);
});
