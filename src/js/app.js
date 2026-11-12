const { decodeEvent, encodeEventUrl } = require('./event-link');
const { resolveWallTime, detectTimeZone, supportedTimeZones } = require('./timezone');

function initializeApp({ window, now: getNow = () => Date.now(),
  setInterval = window.setInterval.bind(window), clearInterval = window.clearInterval.bind(window) }) {
  const { document, navigator, location } = window;
  const el = id => document.getElementById(id);
  el('eventZone').value = detectTimeZone(window.Intl);
  for (const zone of supportedTimeZones(window.Intl)) {
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
  for (const id of ['newEvent', 'eventZone', 'newEventDesc']) el(id).addEventListener('input', invalidateCreation);

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

  el('create').addEventListener('click', () => {
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
  el('copyUrl').addEventListener('click', () => copyTextToClipboard(el('link').dataset.link));

  const event = decodeEvent(location.search);
  if (event.kind === 'invalid') el('linkError').textContent = event.message;
  if (event.kind === 'event') {
    el('existingEventHeader').textContent = 'Currently Scheduled Event';
    el('existingEventTime').textContent = event.date.toString();
    el('eventDesc').textContent = event.description;
    el('countdown').style.display = 'block';
    el('existingEventTimer').style.display = 'block';
    const target = event.date.getTime();
    const timer = setInterval(() => {
      const distance = target - getNow();
      el('days').textContent = Math.floor(distance / 86400000);
      el('hours').textContent = Math.floor((distance % 86400000) / 3600000);
      el('minutes').textContent = Math.floor((distance % 3600000) / 60000);
      el('seconds').textContent = Math.floor((distance % 60000) / 1000);
      if (distance < 0) {
        el('existingEventHeader').textContent = 'Event has already started.';
        el('countdown').style.display = 'none';
        clearInterval(timer);
      }
    }, 200);
  }
}
module.exports = { initializeApp };
