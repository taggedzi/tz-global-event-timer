const {
  MAX_DESCRIPTION_BYTES, DESCRIPTION_TOO_LONG, descriptionByteLength, descriptionFits, decodeEvent, encodeEventUrl
} = require('./event-link');
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
  let eventCopyController;
  function listen(target, type, handler) {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  }
  const el = id => document.getElementById(id);
  el('existingEventTimer').style.removeProperty('display');
  el('eventPrintText').textContent = '';
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
    for (const id of ['newEvent', 'eventZone', 'occurrence', 'newEventDesc']) el(id).removeAttribute('aria-invalid');
  }
  const description = el('newEventDesc');
  const descriptionUsage = el('descriptionUsage');
  const descriptionRemaining = el('descriptionRemaining');
  const formatBytes = new Intl.NumberFormat(navigator.language);
  descriptionUsage.max = MAX_DESCRIPTION_BYTES;
  function updateDescriptionUsage() {
    const used = descriptionByteLength(description.value);
    const remaining = MAX_DESCRIPTION_BYTES - used;
    const overLimit = remaining < 0;
    const count = Math.abs(remaining);
    const unit = count === 1 ? 'byte' : 'bytes';
    descriptionUsage.value = Math.min(used, MAX_DESCRIPTION_BYTES);
    descriptionUsage.parentElement.classList.toggle('over-limit', overLimit);
    descriptionRemaining.textContent = formatBytes.format(count) + ' ' + unit + (overLimit ? ' over limit' : ' left');
  }
  for (const id of ['newEvent', 'eventZone']) listen(el(id), 'input', invalidateCreation);
  listen(description, 'input', () => {
    invalidateCreation();
    updateDescriptionUsage();
  });
  listen(el('compressLink'), 'change', clearShareLink);
  listen(el('occurrence'), 'change', clearShareLink);
  invalidateCreation();
  updateDescriptionUsage();

  function writeText(text) {
    if (window.isSecureContext === false || !navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    return navigator.clipboard.writeText(text);
  }
  copyController = createCopyController({
    getText: () => el('link').dataset.link,
    writeText,
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
    if (!descriptionFits(description.value)) {
      clearShareLink();
      el('formError').textContent = DESCRIPTION_TOO_LONG;
      description.setAttribute('aria-invalid', 'true');
      description.focus();
      return;
    }
    description.removeAttribute('aria-invalid');
    el('eventPreview').textContent = choice.label;
    const url = encodeEventUrl({
      date: choice.date, description: description.value, zone: el('eventZone').value
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
  function clearEventPrintMode() {
    document.body.classList.remove('print-event');
  }
  listen(el('printQr'), 'click', () => {
    clearEventPrintMode();
    window.print();
  });

  const event = decodeEvent(location.search);
  if (event.kind === 'invalid') el('linkError').textContent = event.message;
  if (event.kind === 'event') {
    const localZone = detectTimeZone(intl);
    const hasDescription = Boolean(event.description.trim());
    const printText = el('eventPrintText');
    const getEventText = () => printText.textContent;
    eventCopyController = createCopyController({
      getText: getEventText,
      writeText,
      label: 'Event text',
      onStatus(status) {
        el('eventCopyStatus').textContent = status.message;
        el('copyEventText').disabled = status.kind === 'pending';
        el('eventCopyFallback').hidden = status.kind !== 'error';
        if (status.kind === 'error') {
          const field = el('eventCopyText');
          field.value = getEventText();
          field.focus();
          field.select();
        }
      }
    });
    listen(el('copyEventText'), 'click', () => eventCopyController.copy());
    listen(el('downloadEventText'), 'click', () => {
      const link = document.createElement('a');
      link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(getEventText().toWellFormed());
      link.download = 'event-details.txt';
      link.click();
    });
    listen(el('printEventText'), 'click', () => {
      document.body.classList.add('print-event');
      window.print();
    });
    listen(window, 'afterprint', clearEventPrintMode);
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
      const formattedTime = formatEventTime(event.date, zone, intl, navigator.language);
      el('existingEventTime').textContent = formattedTime;
      const text = hasDescription ? formattedTime + '\n\n' + event.description : formattedTime;
      if (text !== getEventText()) {
        printText.textContent = text;
        eventCopyController.invalidate();
      }
    }
    renderViewer();
    listen(el('viewerZone'), 'change', renderViewer);
    if (event.zone && isTimeZone(event.zone, intl))
      el('originEventTime').textContent = 'Organizer time: ' + formatEventTime(event.date, event.zone, intl, navigator.language);
    el('eventDesc').textContent = event.description;
    el('eventDesc').hidden = !hasDescription;
    el('guestFallback').hidden = hasDescription;
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
    eventCopyController?.destroy();
    clearEventPrintMode();
    for (const remove of listeners) remove();
    if (activeApps.get(window) === app) activeApps.delete(window);
  } };
  activeApps.set(window, app);
  return app;
}
module.exports = { initializeApp };
