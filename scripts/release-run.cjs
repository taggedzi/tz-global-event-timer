const fs = require('node:fs');
const path = require('node:path');
const { createGitHubClient } = require('./github-release.cjs');
const { calendarVersion, packageSite, validatePackage, extractPackage, collectNotices, publishRelease } = require('./release-lib.cjs');
async function main({ env = process.env, command = process.argv[2], clientFactory = createGitHubClient } = {}) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch')
    throw new Error('Release publication is available only in the manually dispatched GitHub workflow.');
  const repository = env.GITHUB_REPOSITORY;
  const client = clientFactory({ repository, token: env.GH_TOKEN });
  const output = path.resolve('release-output');
  const metadataPath = path.join(output,'release.json');
  const run = await client.getRun(env.GITHUB_RUN_ID);
  const runNumber = Number(env.GITHUB_RUN_NUMBER);
  if (String(run.id) !== env.GITHUB_RUN_ID || run.run_number !== runNumber ||
    run.event !== 'workflow_dispatch' || run.head_sha !== env.GITHUB_SHA)
    throw new Error('Workflow run does not match the selected source commit.');
  const version = calendarVersion(run.created_at,runNumber);
  if (command === 'prepare') {
    const metadata = { version, repository, sha: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID,
      runNumber, runCreatedAt: run.created_at, buildTime: new Date().toISOString() };
    const archive = packageSite({ siteDirectory: 'dist', metadata,
      license: fs.readFileSync('LICENSE','utf8'), notices: collectNotices(process.cwd()) });
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output,archive.name),archive.bytes);
    fs.writeFileSync(path.join(output,archive.name + '.sha256'),archive.checksum);
    fs.writeFileSync(metadataPath,JSON.stringify(metadata,null,2) + '\n');
    const extracted = fs.mkdtempSync(path.join(output,'site-'));
    extractPackage(archive.bytes,extracted);
    fs.appendFileSync(env.GITHUB_ENV,'SITE_DIR=' + extracted + '\n');
    console.log('Prepared and validated ' + archive.name);
  } else if (command === 'publish') {
    const metadata = JSON.parse(fs.readFileSync(metadataPath,'utf8'));
    if (metadata.version !== version || metadata.sha !== env.GITHUB_SHA ||
      metadata.repository !== repository || metadata.runId !== env.GITHUB_RUN_ID)
      throw new Error('Packaged metadata does not match the current workflow.');
    const name = 'tz-global-event-timer-' + version + '.zip';
    const bytes = fs.readFileSync(path.join(output,name));
    const files = validatePackage(bytes);
    if (Buffer.from(files['release.json']).toString() !== JSON.stringify(metadata,null,2) + '\n')
      throw new Error('Archive metadata differs from release metadata.');
    const checksum = fs.readFileSync(path.join(output,name + '.sha256'),'utf8');
    const expected = require('node:crypto').createHash('sha256').update(bytes).digest('hex') + '  ' + name + '\n';
    if (checksum !== expected) throw new Error('Archive checksum does not match.');
    const result = await publishRelease({ client, metadata, archive: { name,bytes,checksum } });
    console.log('Release available: ' + result.html_url);
  } else throw new Error('Use prepare or publish.');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
