function createGitHubClient({ repository, token, fetch: request = global.fetch }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !token) throw new Error('Repository and GitHub token are required.');
  const base = 'https://api.github.com/repos/' + repository + '/';
  async function api(resource, { method = 'GET', body, raw = false, contentType = 'application/json', missing = false, upload = false } = {}) {
    const url = upload ? 'https://uploads.github.com/repos/' + repository + '/' + resource : base + resource;
    const response = await request(url, { method, headers: { Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10',
      'Content-Type': contentType }, body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(30000) });
    if (missing && response.status === 404) return null;
    if (!response.ok) throw new Error('GitHub request failed (' + response.status + ') for ' + resource);
    return response.status === 204 ? null : response.json();
  }
  return {
    getRun: id => api('actions/runs/' + id),
    async findRelease(tag) {
      for (let page = 1; ; page++) {
        const releases = await api('releases?per_page=100&page=' + page);
        const match = releases.find(release => release.tag_name === tag);
        if (match) return match;
        if (releases.length < 100) return null;
      }
    },
    async getTagCommit(tag) {
      const ref = await api('git/ref/tags/' + encodeURIComponent(tag), { missing: true });
      if (!ref) return null;
      let object = ref.object;
      for (let depth = 0; object.type === 'tag' && depth < 10; depth++)
        object = (await api('git/tags/' + object.sha)).object;
      if (object.type !== 'commit') throw new Error('Tag does not resolve to a commit.');
      return object.sha;
    },
    latestRelease: () => api('releases/latest', { missing: true }),
    async generateNotes(tag,sha,previous) {
      return (await api('releases/generate-notes', { method: 'POST', body: { tag_name: tag,
        target_commitish: sha, previous_tag_name: previous } })).body;
    },
    createTag: (tag,sha) => api('git/refs', { method: 'POST', body: { ref: 'refs/tags/' + tag, sha } }),
    createDraft: info => api('releases', { method: 'POST', body: { ...info, draft: true } }),
    deleteAsset: id => api('releases/assets/' + id, { method: 'DELETE' }),
    uploadAsset: (id,name,bytes,contentType) => api('releases/' + id + '/assets?name=' + encodeURIComponent(name),
      { method: 'POST', body: bytes, raw: true, upload: true, contentType }),
    publish: id => api('releases/' + id, { method: 'PATCH', body: { draft: false, make_latest: 'true' } })
  };
}
module.exports = { createGitHubClient };
