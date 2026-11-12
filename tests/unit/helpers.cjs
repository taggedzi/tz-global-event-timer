const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');
const { initializeApp } = require('../../src/js/app');
process.env.TZ = 'UTC';
function mount(query = '', options = {}) {
  const dom = new JSDOM(readFileSync('src/index.html', 'utf8'), { url: 'https://example.test/timer/' + query });
  const callbacks = new Map();
  const errors = [];
  let nextId = 0;
  let currentTime = Date.parse('2026-01-01T00:00:00Z');
  dom.window.addEventListener('error', event => { errors.push(event.error); event.preventDefault(); });
  const app = initializeApp({ window: dom.window,
    now: () => currentTime,
    setInterval(fn) { callbacks.set(++nextId, fn); return nextId; },
    clearInterval(id) { callbacks.delete(id); }, ...options });
  return { window: dom.window, document: dom.window.document, callbacks, errors, app,
    setNow(value) { currentTime = Date.parse(value); },
    select(date) {
      dom.window.document.getElementById('newEvent').value = date.toISOString().slice(0,16);
      dom.window.document.getElementById('eventZone').value = 'UTC';
      dom.window.document.getElementById('newEvent').dispatchEvent(new dom.window.Event('input'));
    },
    close() { app?.destroy?.(); dom.window.close(); }
  };
}
module.exports = { mount };
