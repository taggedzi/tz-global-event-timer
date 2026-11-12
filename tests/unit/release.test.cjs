const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { unzipSync, zipSync, strToU8 } = require('fflate');
const { calendarVersion, packageSite, validatePackage, publishRelease } = require('../../scripts/release-lib.cjs');
const sha = 'a'.repeat(40);
const metadata = { version: 'v2026.11.12.42', sha, runId: '123', runNumber: 42,
  runCreatedAt: '2026-11-12T00:00:00Z', buildTime: '2026-11-12T00:01:00Z', repository: 'owner/timer' };
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-release-test-'));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('tz-release-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  fs.writeFileSync(path.join(root,'index.html'), '<!doctype html><title>Timer</title><script src="main.js"></script>');
  fs.writeFileSync(path.join(root,'main.js'), 'console.log("timer")');
  return root;
}
test('calendar versions use UTC creation date and stable run numbers', () => {
  assert.equal(calendarVersion('2026-11-11T23:59:59-05:00',42), 'v2026.11.12.42');
  assert.equal(calendarVersion('2026-11-12T00:00:00Z',43), 'v2026.11.12.43');
  // Reruns retain this original creation time even after midnight.
  assert.equal(calendarVersion(metadata.runCreatedAt,42), metadata.version);
  assert.throws(() => calendarVersion('bad',42), /date/i);
  assert.throws(() => calendarVersion(metadata.runCreatedAt,0), /run/i);
});
test('package has deployable root files, metadata, notices, and a checksum', t => {
  const result = packageSite({ siteDirectory: fixture(t), metadata, license: 'MIT License', notices: 'Third-party licenses' });
  const files = validatePackage(result.bytes);
  for (const name of ['index.html','main.js','release.json','LICENSE','THIRD_PARTY_LICENSES.txt','README.txt','asset-manifest.json'])
    assert.ok(files[name], name);
  assert.equal(JSON.parse(Buffer.from(files['release.json']).toString()).sha, sha);
  assert.match(result.checksum, /^[a-f0-9]{64}  tz-global-event-timer-v2026\.11\.12\.42\.zip\n$/);
  assert.equal(Object.keys(files).some(name => name.includes('node_modules')), false);
});
test('missing entry or referenced assets and unexpected files reject packaging', t => {
  const root = fixture(t);
  fs.unlinkSync(path.join(root,'main.js'));
  assert.throws(() => packageSite({ siteDirectory: root, metadata, license: 'MIT', notices: '' }), /asset|missing/i);
  fs.writeFileSync(path.join(root,'main.js'), '');
  fs.writeFileSync(path.join(root,'.env'), 'SECRET=example');
  assert.throws(() => packageSite({ siteDirectory: root, metadata, license: 'MIT', notices: '' }), /unexpected|unsafe/i);
  fs.unlinkSync(path.join(root,'.env'));
  fs.unlinkSync(path.join(root,'index.html'));
  assert.throws(() => packageSite({ siteDirectory: root, metadata, license: 'MIT', notices: '' }), /index|entry/i);
});
test('archive validation rejects removed assets, corruption, and unsafe extraction names', t => {
  const result = packageSite({ siteDirectory: fixture(t), metadata, license: 'MIT', notices: '' });
  const files = unzipSync(result.bytes);
  delete files['main.js'];
  assert.throws(() => validatePackage(zipSync(files)), /missing|manifest|asset/i);
  files['main.js'] = strToU8('tampered');
  assert.throws(() => validatePackage(zipSync(files)), /hash|manifest/i);
  files['../escape.txt'] = strToU8('bad');
  assert.throws(() => validatePackage(zipSync(files)), /unsafe/i);
});
function clientFixture({ release = null, tag = null, uploadFailure = false, failOnUpload = 0, tagMoved = false } = {}) {
  const calls = [];
  let currentRelease = release;
  let currentTag = tag;
  let tagReads = 0;
  let uploadCount = 0;
  const client = {
    async findRelease() { return currentRelease; },
    async getTagCommit() { return tagMoved && ++tagReads > 1 ? 'b'.repeat(40) : currentTag; },
    async latestRelease() { return null; },
    async generateNotes() { return 'Changes'; },
    async createTag(version, commit) { calls.push('tag'); currentTag = commit; },
    async createDraft(info) { calls.push('draft'); currentRelease = { id: 1, draft: true, assets: [], ...info }; return currentRelease; },
    async deleteAsset() { calls.push('delete'); },
    async uploadAsset(id, name) { calls.push('upload:' + name); uploadCount++; if (uploadFailure || uploadCount === failOnUpload) throw new Error('Upload failed'); },
    async publish(id) { calls.push('publish'); currentRelease.draft = false; return currentRelease; }
  };
  return { client, calls, release: () => currentRelease };
}
function args(client) { return { client, metadata, archive: { name: 'tz-global-event-timer-' + metadata.version + '.zip', bytes: Buffer.from('zip'), checksum: 'checksum' } }; }
test('new release stays draft until both assets upload', async () => {
  const fixture = clientFixture();
  await publishRelease(args(fixture.client));
  assert.deepEqual(fixture.calls.map(value => value.split(':')[0]), ['tag','draft','upload','upload','publish']);
  assert.match(fixture.release().body, /Initial release/);
  assert.match(fixture.release().body, /commit\/a{40}/);
  assert.match(fixture.release().body, /actions\/runs\/123/);
});
test('failed upload leaves a draft; same-run draft can be retried', async () => {
  const fixture = clientFixture({ uploadFailure: true });
  await assert.rejects(publishRelease(args(fixture.client)), /Upload failed/);
  assert.equal(fixture.release().draft, true);
  assert.equal(fixture.calls.includes('publish'), false);
  const retry = clientFixture({ release: fixture.release(), tag: sha });
  await publishRelease(args(retry.client));
  assert.equal(retry.calls.at(-1), 'publish');
});
test('same-run published release is a no-op, but foreign drafts/tags are rejected', async () => {
  const created = clientFixture(); await publishRelease(args(created.client));
  const release = { ...created.release(), assets: [{ name: args(created.client).archive.name }, { name: args(created.client).archive.name + '.sha256' }] };
  const again = clientFixture({ release, tag: sha }); await publishRelease(args(again.client));
  assert.deepEqual(again.calls, []);
  for (const options of [{ tag: 'b'.repeat(40) }, { release: { ...release, draft: true, body: 'someone else' }, tag: sha },
    { release: { ...release, draft: true, target_commitish: 'b'.repeat(40) }, tag: sha }]) {
    const mismatch = clientFixture(options);
    await assert.rejects(publishRelease(args(mismatch.client)), /match|different|belongs/i);
    assert.deepEqual(mismatch.calls, []);
  }
});
test('a tag moved during upload prevents publishing', async () => {
  const fixture = clientFixture({ tagMoved: true });
  await assert.rejects(publishRelease(args(fixture.client)), /commit|tag/i);
  assert.equal(fixture.calls.includes('publish'), false);
});

test('retry replaces only matching draft assets and includes generated change notes', async () => {
  const initial = clientFixture(); await publishRelease(args(initial.client));
  const draft = { ...initial.release(), draft: true, assets: [{ id: 7, name: args(initial.client).archive.name }] };
  const retry = clientFixture({ release: draft, tag: sha });
  await publishRelease(args(retry.client));
  assert.equal(retry.calls[0], 'delete');
  const next = clientFixture();
  next.client.latestRelease = async () => ({ tag_name: 'v2026.11.11.41' });
  next.client.generateNotes = async (tag,commit,previous) => {
    assert.equal(tag,metadata.version); assert.equal(commit,sha); assert.equal(previous,'v2026.11.11.41');
    return 'Changes since the previous release.';
  };
  await publishRelease(args(next.client));
  assert.match(next.release().body,/Changes since/);
});

test('checksum-upload failure and incomplete published releases never publish or overwrite', async () => {
  const failed = clientFixture({ failOnUpload: 2 });
  await assert.rejects(publishRelease(args(failed.client)), /Upload failed/);
  assert.equal(failed.release().draft, true);
  assert.equal(failed.calls.includes('publish'), false);
  const initial = clientFixture(); await publishRelease(args(initial.client));
  const incomplete = clientFixture({ release: initial.release(), tag: sha });
  await assert.rejects(publishRelease(args(incomplete.client)), /complete expected/);
  assert.deepEqual(incomplete.calls, []);
});
