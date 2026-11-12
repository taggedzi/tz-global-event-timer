const { decodeEvent, encodeEventUrl } = require('./event-link');
const { resolveWallTime, detectTimeZone, supportedTimeZones, isTimeZone } = require('./timezone');

const { formatEventTime } = require('./viewer');
const { startCountdown } = require('./countdown');
const activeApps = new WeakMap();

function initializeApp({ window, intl = window.Intl, now: getNow = () => Date.now(),
  setInterval = window.setInterval.bind(window), clearInterval = window.clearInterval.bind(window) }) {
  activeApps.get(window)?.destroy();
  const { document, navigator, location } = window;
  const listeners = [];
  let disposeCountdown;
  function listen(target, type, handler) {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  }
  const el = id => document.getElementById(id);
  el('existingEventTimer').style.removeProperty('display');
  el('linkError').textContent = '';
  el('eventZone').value = detectTimeZone(intl);
  el('timeZones').replaceChildren();
  for (const zone of supportedTimeZones(intl)) {
    const option = document.createElement('option'); option.value = zone; el('timeZones').appendChild(option);
  }
  function invalidateCreation() {
    el('linkContainer').style.display = 'none';
    el('link').replaceChildren();
    delete el('link').dataset.link;
    el('eventPreview').textContent = '';
    el('occurrenceContainer').hidden = true;
    el('occurrence').replaceChildren();
    el('formError').textContent = '';
  }
  for (const id of ['newEvent', 'eventZone', 'newEventDesc']) listen(el(id), 'input', invalidateCreation);
  invalidateCreation();

  function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { document.execCommand('copy'); } catch (error) { console.error(error); }
    textArea.remove();
  }
  function copyTextToClipboard(text) {
    if (!navigator.clipboard) return fallbackCopyTextToClipboard(text);
    navigator.clipboard.writeText(text).catch(error => console.error(error));
  }

  listen(el('create'), 'click', () => {
    const result = resolveWallTime(el('newEvent').value, el('eventZone').value);
    let choice = result.choices[0];
    let message = '';
    if (result.kind === 'invalid') message = 'Select a valid event date, time, and named timezone.';
    if (result.kind === 'gap') message = 'This time does not exist in the selected timezone because the clock moves forward. Choose another time.';
    if (result.kind === 'ambiguous') {
      if (el('occurrence').options.length === 0) {
        const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose an occurrence';
        el('occurrence').appendChild(placeholder);
        result.choices.forEach((candidate, index) => {
          const option = document.createElement('option'); option.value = String(index);
          option.textContent = (index === 0 ? 'First: ' : 'Second: ') + candidate.label;
          el('occurrence').appendChild(option);
        });
      }
      el('occurrenceContainer').hidden = false;
      choice = el('occurrence').value === '' ? null : result.choices[Number(el('occurrence').value)];
      if (!choice) message = 'This time occurs twice. Choose the first or second occurrence.';
    }
    el('formError').textContent = message;
    if (message) {
      el('newEvent').setAttribute('aria-invalid', 'true');
      (result.kind === 'ambiguous' ? el('occurrence') : el('newEvent')).focus();
      return;
    }
    el('newEvent').removeAttribute('aria-invalid');
    el('eventPreview').textContent = choice.label;
    const url = encodeEventUrl({ date: choice.date, description: el('newEventDesc').value, zone: el('eventZone').value }, location.href);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.textContent = url;
    el('link').replaceChildren(anchor);
    el('link').dataset.link = url;
    el('linkContainer').style.display = 'block';
  });
  listen(el('copyUrl'), 'click', () => copyTextToClipboard(el('link').dataset.link));

  const event = decodeEvent(location.search);
  if (event.kind === 'invalid') el('linkError').textContent = event.message;
  if (event.kind === 'event') {
    el('existingEventHeader').textContent = 'Currently Scheduled Event';
    el('viewerZone').value = detectTimeZone(intl);
    el('existingEventTime').dataset.instant = event.date.toISOString();
    function renderViewer() {
      const zone = el('viewerZone').value;
      if (!isTimeZone(zone, intl)) {
        el('viewerZoneError').textContent = 'Choose a valid named timezone. The last valid time is still shown.';
        el('viewerZone').setAttribute('aria-invalid', 'true');
        return;
      }
      el('viewerZoneError').textContent = '';
      el('viewerZone').removeAttribute('aria-invalid');
      el('existingEventTime').textContent = formatEventTime(event.date, zone, intl, navigator.language);
    }
    renderViewer();
    listen(el('viewerZone'), 'change', renderViewer);
    if (event.zone && isTimeZone(event.zone, intl))
      el('originEventTime').textContent = 'Organizer time: ' + formatEventTime(event.date, event.zone, intl, navigator.language);
    el('eventDesc').textContent = event.description;
    el('countdown').style.display = 'block';
    el('existingEventTimer').style.display = 'block';
    disposeCountdown = startCountdown({ target: event.date.getTime(), now: getNow, setInterval, clearInterval, window,
      render(state) {
        for (const id of ['days', 'hours', 'minutes', 'seconds']) el(id).textContent = String(state[id]);
        const header = state.started ? 'Event has already started.' : 'Currently Scheduled Event';
        if (el('existingEventHeader').textContent !== header) el('existingEventHeader').textContent = header;
        el('countdown').style.display = state.started ? 'none' : 'block';
      }
    });
  }
  let destroyed = false;
  const app = { destroy() {
    if (destroyed) return;
    destroyed = true;
    disposeCountdown?.();
    for (const remove of listeners) remove();
    if (activeApps.get(window) === app) activeApps.delete(window);
  } };
  activeApps.set(window, app);
  return app;
}
module.exports = { initializeApp };
