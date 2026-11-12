const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { zipSync, unzipSync, strToU8, strFromU8 } = require('fflate');
const { JSDOM } = require('jsdom');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const extras = new Set(['release.json','LICENSE','THIRD_PARTY_LICENSES.txt','README.txt','asset-manifest.json']);
function safeName(name) {
  return typeof name === 'string' && !name.includes('\\') && !name.includes(':') &&
    !name.includes('\0') && !name.startsWith('/') &&
    name.split('/').every(part => part && !part.startsWith('.') && !['node_modules','src'].includes(part));
}
function allowedAsset(name) {
  return safeName(name) && (/\.(html|js|css|woff2?|ico|svg|png|webp)$/i.test(name) || /\.LICENSE\.txt$/.test(name));
}
function calendarVersion(createdAt, runNumber) {
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999)
    throw new Error('Invalid release creation date.');
  if (!Number.isSafeInteger(runNumber) || runNumber < 1) throw new Error('Invalid workflow run number.');
  return 'v' + date.toISOString().slice(0,10).replaceAll('-','.') + '.' + runNumber;
}
function validateMetadata(metadata) {
  if (!metadata || metadata.version !== calendarVersion(metadata.runCreatedAt,metadata.runNumber) ||
    !/^[a-f0-9]{40}$/.test(metadata.sha) || !/^[1-9]\d*$/.test(String(metadata.runId)) ||
    !/^[\w.-]+\/[\w.-]+$/.test(metadata.repository) || !Number.isFinite(Date.parse(metadata.buildTime)))
    throw new Error('Invalid release metadata.');
}
function readAssets(directory) {
  const files = Object.create(null);
  function visit(relative = '') {
    for (const entry of fs.readdirSync(path.join(directory,relative), { withFileTypes: true })) {
      const name = relative ? relative + '/' + entry.name : entry.name;
      if (!safeName(name) || entry.isSymbolicLink()) throw new Error('Unsafe or unexpected site file: ' + name);
      if (entry.isDirectory()) visit(name);
      else {
        if (!allowedAsset(name) || extras.has(name)) throw new Error('Unexpected site file: ' + name);
        files[name] = fs.readFileSync(path.join(directory,name));
      }
    }
  }
  visit();
  return files;
}
function validateReferences(files) {
  if (!files['index.html']) throw new Error('Missing index.html entry.');
  const dom = new JSDOM(strFromU8(files['index.html']));
  try {
    for (const element of dom.window.document.querySelectorAll('script[src],link[rel="stylesheet"][href],img[src]')) {
      const reference = element.getAttribute('src') || element.getAttribute('href');
      const url = new URL(reference,'https://artifact.invalid/');
      const name = decodeURIComponent(url.pathname.slice(1));
      if (url.origin !== 'https://artifact.invalid' || !files[name]) throw new Error('Missing bundled asset: ' + reference);
    }
  } finally { dom.window.close(); }
}
function packageSite({ siteDirectory, metadata, license, notices }) {
  validateMetadata(metadata);
  const files = readAssets(siteDirectory);
  validateReferences(files);
  files['release.json'] = strToU8(JSON.stringify(metadata,null,2) + '\n');
  files.LICENSE = strToU8(license);
  files['THIRD_PARTY_LICENSES.txt'] = strToU8(notices);
  files['README.txt'] = strToU8('Tz Global Event Timer ' + metadata.version +
    '\n\nExtract this entire ZIP into a static HTTP(S) web root. Keep index.html and its assets together.\n' +
    'No application server, Node runtime, database, or account is required. Serve over HTTPS for clipboard support.\n' +
    'Event links are snapshots; distribute a new link after changing an event.\n' +
    'Source commit: https://github.com/' + metadata.repository + '/commit/' + metadata.sha + '\n');
  const manifest = Object.fromEntries(Object.entries(files).map(([name,bytes]) => [name,digest(bytes)]));
  files['asset-manifest.json'] = strToU8(JSON.stringify(manifest,null,2) + '\n');
  const bytes = Buffer.from(zipSync(files));
  validatePackage(bytes);
  const name = 'tz-global-event-timer-' + metadata.version + '.zip';
  return { name, bytes, checksum: digest(bytes) + '  ' + name + '\n' };
}
function validatePackage(bytes) {
  const files = unzipSync(bytes);
  for (const name of Object.keys(files)) if (!safeName(name) || (!extras.has(name) && !allowedAsset(name)))
    throw new Error('Unsafe archive entry: ' + name);
  for (const name of extras) if (!files[name]) throw new Error('Missing archive file: ' + name);
  const manifest = JSON.parse(strFromU8(files['asset-manifest.json']));
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Invalid asset manifest.');
  const actualNames = Object.keys(files).filter(name => name !== 'asset-manifest.json').sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(Object.keys(manifest).sort())) throw new Error('Missing files or unexpected manifest entries.');
  for (const name of actualNames) if (manifest[name] !== digest(files[name])) throw new Error('Asset hash mismatch: ' + name);
  validateMetadata(JSON.parse(strFromU8(files['release.json'])));
  validateReferences(files);
  return files;
}
function extractPackage(bytes, directory) {
  const files = validatePackage(bytes);
  fs.mkdirSync(directory, { recursive: true });
  if (fs.readdirSync(directory).length) throw new Error('Extraction directory must be empty.');
  const root = path.resolve(directory);
  for (const [name,content] of Object.entries(files)) {
    const destination = path.resolve(root,name);
    if (!destination.startsWith(root + path.sep)) throw new Error('Unsafe extraction path.');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination,content);
  }
}
function collectNotices(projectRoot) {
  const lock = JSON.parse(fs.readFileSync(path.join(projectRoot,'package-lock.json'),'utf8'));
  const notices = [];
  for (const [relative, info] of Object.entries(lock.packages)) {
    if (!relative || info.dev) continue;
    const directory = path.join(projectRoot,relative);
    const pkg = JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8'));
    const licenseFiles = fs.readdirSync(directory).filter(name => /^(licen[cs]e|copying|notice)([.-]|$)/i.test(name) && fs.statSync(path.join(directory,name)).isFile());
    if (!licenseFiles.length) throw new Error('Missing third-party license for ' + pkg.name);
    notices.push(pkg.name + '@' + pkg.version + ' (' + (pkg.license || 'See notice') + ')\n' +
      licenseFiles.map(name => fs.readFileSync(path.join(directory,name),'utf8')).join('\n'));
  }
  // The CSS runtime is bundled into the app even though it is build tooling.
  for (const name of ['style-loader','css-loader','webpack']) {
    const directory = path.join(projectRoot,'node_modules',name);
    notices.push(name + '\n' + fs.readFileSync(path.join(directory,'LICENSE'),'utf8'));
  }
  return notices.join('\n\n========================================\n\n');
}
async function publishRelease({ client, metadata, archive }) {
  validateMetadata(metadata);
  const { version,sha,repository,runId } = metadata;
  const marker = '<!-- release-run:' + runId + ' commit:' + sha + ' -->';
  let release = await client.findRelease(version);
  const tagCommit = await client.getTagCommit(version);
  if (tagCommit && tagCommit !== sha) throw new Error('Tag points at a different commit.');
  if (release && (!release.body?.includes(marker) || release.target_commitish !== sha)) throw new Error('Release belongs to a different run or commit.');
  if (release && !release.draft) {
    const names = new Set(release.assets.map(asset => asset.name));
    if (tagCommit !== sha || !names.has(archive.name) || !names.has(archive.name + '.sha256')) throw new Error('Published release does not match the complete expected release.');
    return release;
  }
  if (!tagCommit) await client.createTag(version,sha);
  if (!release) {
    const previous = await client.latestRelease();
    const changes = previous ? await client.generateNotes(version,sha,previous.tag_name) : 'Initial release.';
    const body = marker + '\n\n' + changes + '\n\n' +
      '- Source: https://github.com/' + repository + '/commit/' + sha + '\n' +
      '- Built (UTC): ' + metadata.buildTime + '\n' +
      '- Workflow: https://github.com/' + repository + '/actions/runs/' + runId + '\n\n' +
      'Download ' + archive.name + ' and its .sha256 file. Verify with sha256sum -c ' + archive.name + '.sha256 ' +
      '(PowerShell: Get-FileHash -Algorithm SHA256). Extract the ZIP into a static HTTP(S) web root; keep all files together. ' +
      'The attached ZIP is ready to host. GitHub source archives contain the source and need a build.';
    release = await client.createDraft({ tag_name: version, target_commitish: sha,
      name: 'Tz Global Event Timer ' + version, body });
  }
  for (const asset of release.assets) if ([archive.name,archive.name + '.sha256'].includes(asset.name)) await client.deleteAsset(asset.id);
  await client.uploadAsset(release.id,archive.name,archive.bytes,'application/zip');
  await client.uploadAsset(release.id,archive.name + '.sha256',Buffer.from(archive.checksum),'text/plain');
  if (await client.getTagCommit(version) !== sha) throw new Error('Tag commit changed during upload.');
  return client.publish(release.id);
}
module.exports = { calendarVersion, validateMetadata, packageSite, validatePackage, extractPackage, collectNotices, publishRelease };
