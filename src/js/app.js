const { decodeEvent, encodeEventUrl } = require('./event-link');
const { resolveWallTime, detectTimeZone, supportedTimeZones, isTimeZone } = require('./timezone');

const { formatEventTime } = require('./viewer');
const { startCountdown } = require('./countdown');
const { createCopyController } = require('./clipboard');
const QRCode = require('qrcode');
const activeApps = new WeakMap();

function initializeApp({ window, intl = window.Intl, now: getNow = () => Date.now(),
  setInterval = window.setInterval.bind(window), clearInterval = window.clearInterval.bind(window) }) {
  activeApps.get(window)?.destroy();
  const { document, navigator, location } = window;
  const listeners = [];
  let disposeCountdown;
  let copyController;
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
  function clearQrCode() {
    el('qrResult').hidden = true;
    el('qrImage').removeAttribute('src');
    el('downloadQr').removeAttribute('href');
    el('qrError').textContent = '';
  }
  function clearShareLink() {
    el('linkContainer').style.display = 'none';
    el('link').replaceChildren();
    delete el('link').dataset.link;
    el('shareUrl').value = '';
    clearQrCode();
    copyController?.invalidate();
  }
  function invalidateCreation() {
    clearShareLink();
    el('eventPreview').textContent = '';
    el('occurrenceContainer').hidden = true;
    el('occurrence').replaceChildren();
    el('formError').textContent = '';
    for (const id of ['newEvent', 'eventZone', 'occurrence']) el(id).removeAttribute('aria-invalid');
  }
  for (const id of ['newEvent', 'eventZone', 'newEventDesc']) listen(el(id), 'input', invalidateCreation);
  listen(el('compressLink'), 'change', clearShareLink);
  listen(el('occurrence'), 'change', clearShareLink);
  invalidateCreation();

  copyController = createCopyController({
    getUrl: () => el('link').dataset.link,
    writeText(text) {
      if (window.isSecureContext === false || !navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      return navigator.clipboard.writeText(text);
    },
    onStatus(status) {
      el('copyStatus').textContent = status.message;
      el('copyUrl').disabled = status.kind === 'pending' || !el('link').dataset.link;
      if (status.kind === 'error') { el('shareUrl').focus(); el('shareUrl').select(); }
    }
  });
  copyController.invalidate();

  listen(el('newEventContainer'), 'submit', event => {
    event.preventDefault();
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
      const invalidField = result.kind === 'ambiguous' ? el('occurrence') : !isTimeZone(el('eventZone').value) ? el('eventZone') : el('newEvent');
      invalidField.setAttribute('aria-invalid', 'true');
      invalidField.focus();
      return;
    }
    el('newEvent').removeAttribute('aria-invalid');
    el('eventPreview').textContent = choice.label;
    const url = encodeEventUrl({
      date: choice.date, description: el('newEventDesc').value, zone: el('eventZone').value
    }, location.href, { compress: el('compressLink').checked });
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.textContent = 'Open event link';
    el('link').replaceChildren(anchor);
    el('link').dataset.link = url;
    el('shareUrl').value = url;
    clearQrCode();
    copyController.invalidate();
    el('linkContainer').style.display = 'grid';
  });
  listen(el('copyUrl'), 'click', () => copyController.copy());
  listen(el('generateQr'), 'click', () => {
    const url = el('link').dataset.link;
    if (!url || !el('qrResult').hidden) return;

    // Even a QR code containing only digits cannot fit more than 7,089 characters.
    if (url.length > 7089) {
      el('qrError').textContent = 'This link is too long for a QR code. Compress the link or shorten the event description.';
      return;
    }
    QRCode.toDataURL(document.createElement('canvas'), url, { scale: 8, margin: 4 }, (error, imageUrl) => {
      if (error) {
        el('qrError').textContent = error.message.includes('too big')
          ? 'This link is too long for a QR code. Compress the link or shorten the event description.'
          : 'Could not generate a QR code. You can still copy the event link.';
        return;
      }
      el('qrError').textContent = '';
      el('qrImage').src = imageUrl;
      el('downloadQr').href = imageUrl;
      el('qrResult').hidden = false;
      el('downloadQr').focus();
    });
  });
  listen(el('printQr'), 'click', () => window.print());

  const event = decodeEvent(location.search);
  if (event.kind === 'invalid') el('linkError').textContent = event.message;
  if (event.kind === 'event') {
    const localZone = detectTimeZone(intl);
    el('viewerZone').value = localZone;
    el('existingEventHeader').textContent = '';
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
      el('displayTimeLabel').textContent = zone === localZone ? 'Your local time' : 'Event time in selected zone';
      el('existingEventTime').textContent = formatEventTime(event.date, zone, intl, navigator.language);
    }
    renderViewer();
    listen(el('viewerZone'), 'change', renderViewer);
    if (event.zone && isTimeZone(event.zone, intl))
      el('originEventTime').textContent = 'Organizer time: ' + formatEventTime(event.date, event.zone, intl, navigator.language);
    el('eventDesc').textContent = event.description;
    el('guestFallback').hidden = Boolean(event.description.trim());
    el('countdown').style.display = 'block';
    el('existingEventTimer').style.display = 'grid';
    disposeCountdown = startCountdown({ target: event.date.getTime(), now: getNow, setInterval, clearInterval, window,
      render(state) {
        for (const id of ['days', 'hours', 'minutes', 'seconds']) el(id).textContent = String(state[id]);
        const header = state.started ? 'Event has already started.' : '';
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
    copyController.destroy();
    for (const remove of listeners) remove();
    if (activeApps.get(window) === app) activeApps.delete(window);
  } };
  activeApps.set(window, app);
  return app;
}
module.exports = { initializeApp };
