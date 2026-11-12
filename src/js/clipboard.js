function createCopyController({ getUrl, writeText, onStatus }) {
  let generation = 0;
  let active = true;
  return {
    async copy() {
      const url = getUrl();
      if (!active || !url) return;
      const request = ++generation;
      onStatus({ kind: 'pending', message: 'Copying link…' });
      let status;
      try {
        await writeText(url);
        status = { kind: 'success', message: 'Link copied.' };
      } catch {
        status = { kind: 'error', message: 'Could not copy automatically. Copy the selected link manually.' };
      }
      if (active && request === generation && url === getUrl()) onStatus(status);
    },
    invalidate() { if (active) { generation++; onStatus({ kind: 'idle', message: '' }); } },
    destroy() { active = false; generation++; }
  };
}
module.exports = { createCopyController };
