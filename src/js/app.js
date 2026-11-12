const { decodeEvent, encodeEventUrl } = require('./event-link');

function initializeApp({ window, flatpickr, now: getNow = () => Date.now(),
  setInterval = window.setInterval.bind(window), clearInterval = window.clearInterval.bind(window) }) {
  const { document, navigator, location } = window;
  const el = id => document.getElementById(id);
  const picker = flatpickr('#newEvent', { enableTime: true, dateFormat: 'Y-m-d H:i' });

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
    const date = picker.selectedDates[0];
    if (!date || !Number.isFinite(date.getTime())) {
      el('formError').textContent = 'Select a valid event date and time.';
      el('newEvent').setAttribute('aria-invalid', 'true');
      el('newEvent').focus();
      return;
    }
    el('formError').textContent = '';
    el('newEvent').removeAttribute('aria-invalid');
    const url = encodeEventUrl({ date, description: el('newEventDesc').value }, location.href);
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
