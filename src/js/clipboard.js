function createCopyController({ getText, writeText, onStatus, label = 'Link' }) {
  let generation = 0;
  let active = true;
  const content = label.toLowerCase();
  return {
    async copy() {
      const text = getText();
      if (!active || !text) return;
      const request = ++generation;
      onStatus({ kind: 'pending', message: 'Copying ' + content + '…' });
      let status;
      try {
        await writeText(text);
        status = { kind: 'success', message: label + ' copied.' };
      } catch {
        status = { kind: 'error', message: 'Could not copy automatically. Copy the selected ' + content + ' manually.' };
      }
      if (active && request === generation && text === getText()) onStatus(status);
    },
    invalidate() { if (active) { generation++; onStatus({ kind: 'idle', message: '' }); } },
    destroy() { active = false; generation++; }
  };
}
module.exports = { createCopyController };
