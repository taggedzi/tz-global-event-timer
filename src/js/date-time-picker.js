const { Temporal } = require('@js-temporal/polyfill');
const { isTimeZone } = require('./timezone');

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return null;
  try { return Temporal.PlainDate.from(value); } catch { return null; }
}

function initializeDateTimePicker({ document, locale, getNow, listen }) {
  const el = id => document.getElementById(id);
  const trigger = el('eventDateTimeTrigger');
  const committed = el('newEvent');
  const dialog = el('eventDateTimePicker');
  const date = el('pickerDate');
  const hour = el('pickerHour');
  const minute = el('pickerMinute');
  const period = el('pickerPeriod');
  const hour12 = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12;
  const monthLabel = el('pickerMonth');
  const previous = el('pickerPreviousMonth');
  const next = el('pickerNextMonth');
  const days = el('pickerDays');
  const error = el('pickerError');
  let month;
  if (hour12) {
    hour.min = '1';
    hour.max = '12';
    el('pickerPeriodField').hidden = false;
  }

  function updateTrigger() {
    trigger.textContent = committed.value
      ? Temporal.PlainDateTime.from(committed.value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', calendar: 'gregory' })
      : 'Choose date and time';
  }

  function showMonth(firstDay) {
    month = firstDay;
    monthLabel.textContent = month.toLocaleString(locale, { month: 'long', year: 'numeric', calendar: 'gregory' });
    previous.disabled = month.year === 1 && month.month === 1;
    next.disabled = month.year === 9999 && month.month === 12;
    const cells = document.createDocumentFragment();
    for (let offset = 0; offset < month.dayOfWeek % 7; offset++) {
      const blank = document.createElement('span');
      blank.setAttribute('aria-hidden', 'true');
      cells.append(blank);
    }
    for (let day = 1; day <= month.daysInMonth; day++) {
      const calendarDate = month.with({ day });
      const cell = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'calendarDay';
      radio.value = calendarDate.toString();
      radio.checked = radio.value === date.value;
      radio.setAttribute('aria-label', calendarDate.toLocaleString(locale, { dateStyle: 'long', calendar: 'gregory' }));
      const number = document.createElement('span');
      number.textContent = day;
      cell.append(radio, number);
      cells.append(cell);
    }
    days.replaceChildren(cells);
  }

  function clearError() {
    error.textContent = '';
    for (const field of [date, hour, minute]) field.removeAttribute('aria-invalid');
  }

  function showError(field, message) {
    error.textContent = message;
    field.setAttribute('aria-invalid', 'true');
    field.focus();
  }

  updateTrigger();
  listen(committed, 'input', updateTrigger);
  listen(trigger, 'click', () => {
    const zone = el('eventZone').value;
    const validZone = isTimeZone(zone);
    const wallTime = committed.value || Temporal.Instant.fromEpochMilliseconds(getNow())
      .toZonedDateTimeISO(validZone ? zone : 'UTC').toPlainDateTime().toString({ smallestUnit: 'minute' });
    const draft = Temporal.PlainDateTime.from(wallTime);
    date.value = draft.toPlainDate().toString();
    hour.value = hour12 ? String(draft.hour % 12 || 12) : String(draft.hour).padStart(2, '0');
    minute.value = String(draft.minute).padStart(2, '0');
    period.value = draft.hour < 12 ? 'am' : 'pm';
    el('pickerZone').textContent = validZone ? zone : 'Select a valid event time zone in the form.';
    clearError();
    showMonth(parseDate(date.value).with({ day: 1 }));
    dialog.showModal();
  });
  listen(previous, 'click', () => showMonth(month.subtract({ months: 1 })));
  listen(next, 'click', () => showMonth(month.add({ months: 1 })));
  listen(days, 'change', event => {
    date.value = event.target.value;
    clearError();
  });
  listen(date, 'input', () => {
    clearError();
    const selected = parseDate(date.value);
    if (selected && !selected.with({ day: 1 }).equals(month)) {
      showMonth(selected.with({ day: 1 }));
    } else {
      for (const radio of days.querySelectorAll('input')) radio.checked = radio.value === date.value;
    }
  });
  for (const field of [hour, minute]) {
    listen(field, 'input', clearError);
    listen(field, 'wheel', event => {
      if (document.activeElement !== field || !event.deltaY || event.ctrlKey || !event.cancelable) return;
      event.preventDefault();
      const before = field.value;
      if (event.deltaY < 0) field.stepUp();
      else field.stepDown();
      if (field.value !== before) clearError();
    }, { passive: false });
  }
  listen(el('pickerCancel'), 'click', () => dialog.close());
  listen(dialog, 'close', () => trigger.focus());
  listen(el('pickerForm'), 'submit', event => {
    event.preventDefault();
    if (!parseDate(date.value)) {
      showError(date, 'Enter a valid date in YYYY-MM-DD format or choose one from the calendar.');
      return;
    }
    if (!hour.validity.valid) {
      showError(hour, 'Enter a whole hour from ' + hour.min + ' to ' + hour.max + '.');
      return;
    }
    if (!minute.validity.valid) {
      showError(minute, 'Enter a whole minute from 0 to 59.');
      return;
    }
    const hours = hour12 ? hour.valueAsNumber % 12 + (period.value === 'pm' ? 12 : 0) : hour.valueAsNumber;
    const value = date.value + 'T' + String(hours).padStart(2, '0') + ':' + String(minute.valueAsNumber).padStart(2, '0');
    if (committed.value !== value) {
      committed.value = value;
      committed.dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));
    }
    dialog.close();
  });
  return () => { if (dialog.open) dialog.close(); };
}

module.exports = { initializeDateTimePicker };
