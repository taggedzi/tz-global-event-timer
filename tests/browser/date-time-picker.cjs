async function fillTime(picker, time) {
  const [hour, minute] = time.split(':');
  const period = picker.getByLabel('AM or PM', { exact: true });
  let displayedHour = hour;
  if (await period.isVisible()) {
    displayedHour = String(Number(hour) % 12 || 12);
    await period.selectOption(Number(hour) < 12 ? 'am' : 'pm');
  }
  await picker.getByRole('spinbutton', { name: 'Hour', exact: true }).fill(displayedHour);
  await picker.getByRole('spinbutton', { name: 'Minute', exact: true }).fill(minute);
}

async function selectDateTime(page, value) {
  const [date, time] = value.split('T');
  await page.getByRole('button', { name: /^Event date and time/ }).click();
  const picker = page.getByRole('dialog', { name: 'Choose event date and time' });
  await picker.getByLabel('Date', { exact: true }).fill(date);
  await fillTime(picker, time);
  await picker.getByRole('button', { name: 'Use date and time' }).click();
}

module.exports = { fillTime, selectDateTime };
