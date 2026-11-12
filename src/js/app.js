const {
  MAX_DESCRIPTION_BYTES, DESCRIPTION_TOO_LONG, CRYPTO_UNAVAILABLE, descriptionByteLength, descriptionFits,
  decodeEvent, encodeEventUrl, isProtectedEventLink, readProtectedEventLink, encodeProtectedEventUrl, unlockEvent
} = require('./event-link');
const { resolveWallTime, detectTimeZone, supportedTimeZones, isTimeZone } = require('./timezone');
const { initializeDateTimePicker } = require('./date-time-picker');

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
  let destroyed = false;
  let shareRevision = 0;
  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }
  const el = id => document.getElementById(id);
  const dateTimeTrigger = el('eventDateTimeTrigger');
  const closeDateTimePicker = initializeDateTimePicker({ document, locale: navigator.language, getNow, listen });
  const initialHash = location.hash;
  const protectedLink = isProtectedEventLink(initialHash);
  const linkPassword = el('linkPassword');
  const createButton = el('create');
  const unlockForm = el('unlockEventForm');
  const unlockPassword = el('unlockPassword');
  const unlockButton = el('unlockEventButton');
  linkPassword.value = '';
  el('linkPasswordField').hidden = false;
  unlockForm.hidden = true;
  unlockPassword.value = '';
  unlockPassword.readOnly = false;
  unlockPassword.removeAttribute('aria-invalid');
  el('unlockError').textContent = '';
  unlockButton.disabled = false;
  unlockButton.textContent = 'Unlock event';
  el('existingEventTimer').style.removeProperty('display');
  for (const id of ['eventDesc', 'existingEventTime', 'originEventTime', 'eventPrintText']) el(id).textContent = '';
  delete el('existingEventTime').dataset.instant;
  el('eventCopyText').value = '';
  el('eventCopyFallback').hidden = true;
  el('copyEventText').disabled = false;
  el('eventCopyStatus').textContent = '';
  el('linkError').textContent = '';
  el('eventZone').value = detectTimeZone(intl);
  el('timeZones').replaceChildren();
  const timeZones = supportedTimeZones(intl);
  for (const zone of timeZones) {
    const option = document.createElement('option'); option.value = zone; el('timeZones').appendChild(option);
  }
  function clearQrCode() {
    el('qrResult').hidden = true;
    el('qrImage').removeAttribute('src');
    el('downloadQr').removeAttribute('href');
    el('qrError').textContent = '';
  }
  function clearShareLink() {
    shareRevision++;
    createButton.disabled = false;
    createButton.textContent = 'Create event link';
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
    for (const id of ['eventDateTimeTrigger', 'eventZone', 'occurrence', 'newEventDesc']) el(id).removeAttribute('aria-invalid');
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
  listen(linkPassword, 'input', () => {
    clearShareLink();
    el('formError').textContent = '';
  });
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

  listen(el('newEventContainer'), 'submit', async event => {
    event.preventDefault();
    if (createButton.disabled) return;
    clearShareLink();
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
      const invalidField = result.kind === 'ambiguous' ? el('occurrence') : !isTimeZone(el('eventZone').value) ? el('eventZone') : dateTimeTrigger;
      invalidField.setAttribute('aria-invalid', 'true');
      invalidField.focus();
      return;
    }
    dateTimeTrigger.removeAttribute('aria-invalid');
    if (!descriptionFits(description.value)) {
      clearShareLink();
      el('formError').textContent = DESCRIPTION_TOO_LONG;
      description.setAttribute('aria-invalid', 'true');
      description.focus();
      return;
    }
    description.removeAttribute('aria-invalid');
    el('eventPreview').textContent = choice.label;
    const details = {
      date: choice.date, description: description.value, zone: el('eventZone').value
    };
    const compress = el('compressLink').checked;
    const password = linkPassword.value;
    const revision = shareRevision;
    let url;
    try {
      if (password) {
        if (!window.crypto?.subtle) {
          el('formError').textContent = CRYPTO_UNAVAILABLE;
          return;
        }
        createButton.disabled = true;
        createButton.textContent = 'Protecting link…';
        url = await encodeProtectedEventUrl(details, location.href, { compress, password, crypto: window.crypto });
      } else {
        url = encodeEventUrl(details, location.href, { compress });
      }
    } catch (error) {
      if (!destroyed && revision === shareRevision) {
        el('formError').textContent = password ? 'Could not protect this link. Try creating it again.' : error.message;
      }
      return;
    } finally {
      if (!destroyed && revision === shareRevision) {
        createButton.disabled = false;
        createButton.textContent = 'Create event link';
      }
    }
    if (destroyed || revision !== shareRevision) return;
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
        if (destroyed || el('link').dataset.link !== url) return;
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

  function showEvent(event) {
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
    const viewerZone = el('viewerZone');
    viewerZone.replaceChildren(
      new window.Option(`Your local time (${localZone})`, localZone),
      ...timeZones.filter(zone => zone !== localZone).map(zone => new window.Option(zone, zone))
    );
    viewerZone.value = localZone;
    el('existingEventHeader').textContent = '';
    el('existingEventTime').dataset.instant = event.date.toISOString();
    function renderViewer() {
      const zone = viewerZone.value;
      if (!zone) return;
      el('displayTimeLabel').textContent = zone === localZone ? 'The event in your local time' : 'Event time in selected zone';
      const formattedTime = formatEventTime(event.date, zone, intl, navigator.language);
      el('existingEventTime').textContent = formattedTime;
      const text = hasDescription ? formattedTime + '\n\n' + event.description : formattedTime;
      if (text !== getEventText()) {
        printText.textContent = text;
        eventCopyController.invalidate();
      }
    }
    renderViewer();
    listen(viewerZone, 'change', renderViewer);
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
  listen(window, 'hashchange', () => {
    const openingProtectedLink = isProtectedEventLink(location.hash);
    if (location.hash === initialHash || (!protectedLink && !openingProtectedLink)) return;
    // Firefox can restore the creator's form values across this reload.
    if (openingProtectedLink) el('newEventContainer').reset();
    location.reload();
  });
  if (protectedLink) {
    // Keep the fragment intact when navigating to the main content.
    listen(document.querySelector('.skip-link'), 'click', event => {
      event.preventDefault();
      el('main').focus();
    });
    const payload = readProtectedEventLink(initialHash);
    if (!payload) {
      el('linkError').textContent = 'This password protected link is invalid. Ask the organizer for a new link.';
    } else if (!window.crypto?.subtle) {
      el('linkError').textContent = CRYPTO_UNAVAILABLE;
    } else {
      unlockForm.hidden = false;
      listen(unlockPassword, 'input', () => {
        unlockPassword.removeAttribute('aria-invalid');
        el('unlockError').textContent = '';
      });
      listen(unlockForm, 'submit', async event => {
        event.preventDefault();
        if (unlockButton.disabled || !unlockPassword.value) return;
        unlockButton.disabled = true;
        unlockPassword.readOnly = true;
        unlockButton.textContent = 'Unlocking event…';
        unlockPassword.removeAttribute('aria-invalid');
        el('unlockError').textContent = '';
        let result;
        try {
          result = await unlockEvent(payload, unlockPassword.value, window.crypto);
        } catch {
          // A wrong password and tampered ciphertext both fail authentication.
        }
        if (destroyed || location.hash !== initialHash) return;
        unlockPassword.value = '';
        unlockPassword.readOnly = false;
        unlockButton.disabled = false;
        unlockButton.textContent = 'Unlock event';
        if (result?.kind !== 'event') {
          el('unlockError').textContent = 'Could not unlock this event. Check the password or ask the organizer for a new link.';
          unlockPassword.setAttribute('aria-invalid', 'true');
          unlockPassword.focus();
          return;
        }
        unlockForm.hidden = true;
        showEvent(result);
        el('existingEventTimer').focus();
      });
    }
  } else {
    const event = decodeEvent(location.search);
    if (event.kind === 'invalid') el('linkError').textContent = event.message;
    if (event.kind === 'event') showEvent(event);
  }
  const app = { destroy() {
    if (destroyed) return;
    destroyed = true;
    disposeCountdown?.();
    copyController.destroy();
    eventCopyController?.destroy();
    clearEventPrintMode();
    for (const remove of listeners) remove();
    closeDateTimePicker();
    if (activeApps.get(window) === app) activeApps.delete(window);
  } };
  activeApps.set(window, app);
  return app;
}
module.exports = { initializeApp };
