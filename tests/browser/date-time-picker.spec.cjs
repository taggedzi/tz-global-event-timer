const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const { decodeEvent } = require('../../src/js/event-link');
const { fillTime } = require('./date-time-picker.cjs');

test('confirms a calendar choice and keeps it when later edits are canceled', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-01-01T23:30:00Z'));
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await page.getByLabel('Event time zone', { exact: true }).fill('Asia/Kolkata');
  const trigger = page.getByRole('button', { name: /^Event date and time/ });
  const picker = page.getByRole('dialog', { name: 'Choose event date and time' });
  await trigger.click();
  await expect(picker).toContainText('Asia/Kolkata');
  await expect(picker.getByLabel('Date', { exact: true })).toHaveValue('2026-01-02');
  const hour = picker.getByRole('spinbutton', { name: 'Hour', exact: true });
  const minute = picker.getByRole('spinbutton', { name: 'Minute', exact: true });
  await expect(hour).toHaveValue('05');
  await expect(minute).toHaveValue('00');
  await expect(picker.getByLabel('AM or PM', { exact: true })).toBeHidden();
  await expect(picker.getByRole('button', { name: 'Use date and time' })).toBeInViewport();
  await expect(picker.getByRole('button', { name: 'Cancel' })).toBeInViewport();
  expect((await new AxeBuilder({ page }).include('#eventDateTimePicker').analyze()).violations).toEqual([]);
  await expect(trigger).toHaveText('Choose date and time');
  await picker.getByRole('button', { name: 'Use date and time' }).click();
  await expect(picker).toBeHidden();
  await expect(trigger).toHaveText('2 Jan 2026, 05:00');

  await trigger.click();
  await picker.getByRole('button', { name: 'Next month' }).click();
  await picker.getByRole('radio', { name: '3 February 2026', exact: true }).check();
  await fillTime(picker, '18:44');
  await minute.press('ArrowUp');
  await expect(minute).toHaveValue('45');
  await expect(trigger).toHaveText('2 Jan 2026, 05:00');
  await picker.getByRole('button', { name: 'Use date and time' }).click();
  await expect(picker).toBeHidden();
  await expect(trigger).toHaveText('3 Feb 2026, 18:45');
  await expect(trigger).toBeFocused();

  await page.getByRole('button', { name: 'Create event link' }).click();
  const link = page.getByRole('link', { name: 'Open event link' });
  const url = await link.getAttribute('href');
  expect(decodeEvent(new URL(url).search).date.toISOString()).toBe('2026-02-03T13:15:00.000Z');

  await trigger.click();
  await expect(picker.getByRole('radio', { name: '3 February 2026', exact: true })).toBeChecked();
  await fillTime(picker, '08:00');
  await picker.getByRole('button', { name: 'Cancel' }).click();
  await expect(picker).toBeHidden();
  await expect(trigger).toHaveText('3 Feb 2026, 18:45');
  await expect(link).toHaveAttribute('href', url);
  await trigger.click();
  await expect(hour).toHaveValue('18');
  await expect(minute).toHaveValue('45');
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('wheel steps only the focused time field and otherwise scrolls the dialog', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /^Event date and time/ });
  await trigger.click();
  const picker = page.getByRole('dialog');
  const hour = picker.getByRole('spinbutton', { name: 'Hour', exact: true });
  const minute = picker.getByRole('spinbutton', { name: 'Minute', exact: true });
  await fillTime(picker, '22:01');
  await hour.focus();
  await hour.hover();
  await page.mouse.wheel(0, -100);
  await expect(hour).toHaveValue('23');
  await page.mouse.wheel(0, -100);
  await expect(hour).toHaveValue('23');
  await page.mouse.wheel(0, 100);
  await expect(hour).toHaveValue('22');

  await minute.hover();
  const scrollTop = () => picker.evaluate(dialog => dialog.scrollTop);
  const beforeScroll = await scrollTop();
  expect(beforeScroll).toBeGreaterThan(0);
  await page.mouse.wheel(0, -100);
  await expect.poll(scrollTop).toBeLessThan(beforeScroll);
  await expect(hour).toHaveValue('22');
  await expect(minute).toHaveValue('01');

  await minute.focus();
  await minute.hover();
  await page.mouse.wheel(0, 100);
  await expect(minute).toHaveValue('0');
  await page.mouse.wheel(0, 100);
  await expect(minute).toHaveValue('0');
  await picker.getByRole('button', { name: 'Use date and time' }).click();
  await expect(trigger).toContainText('22:00');
});

test.describe('12 hour time', () => {
  test.use({ locale: 'en-US', viewport: { width: 320, height: 720 } });

  test('chooses AM or PM, validates numeric bounds, and restores the confirmed time after cancel', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-05-01T00:05:00Z'));
    await page.goto('/');
    await page.getByLabel('Event time zone', { exact: true }).fill('UTC');
    const trigger = page.getByRole('button', { name: /^Event date and time/ });
    await trigger.click();
    const picker = page.getByRole('dialog');
    const hour = picker.getByRole('spinbutton', { name: 'Hour', exact: true });
    const minute = picker.getByRole('spinbutton', { name: 'Minute', exact: true });
    const period = picker.getByLabel('AM or PM', { exact: true });
    const confirm = picker.getByRole('button', { name: 'Use date and time' });
    await expect(hour).toHaveValue('12');
    await expect(minute).toHaveValue('05');
    await expect(period).toHaveValue('am');
    await expect(period).toBeInViewport();
    await expect(confirm).toBeInViewport();
    await hour.fill('0');
    await confirm.click();
    await expect(picker.getByRole('alert')).toHaveText('Enter a whole hour from 1 to 12.');
    await expect(hour).toBeFocused();
    await hour.fill('12');
    await minute.fill('60');
    await confirm.click();
    await expect(picker.getByRole('alert')).toHaveText('Enter a whole minute from 0 to 59.');
    await expect(minute).toBeFocused();
    await minute.fill('7');
    await period.selectOption('pm');
    await confirm.click();
    await expect(picker).toBeHidden();
    await expect(trigger).toContainText('12:07 PM');

    await trigger.click();
    await period.selectOption('am');
    await picker.getByRole('button', { name: 'Cancel' }).click();
    await expect(trigger).toContainText('12:07 PM');
    await trigger.click();
    await expect(period).toHaveValue('pm');
    await expect(minute).toHaveValue('07');
    await period.selectOption('am');
    await confirm.click();
    await expect(trigger).toContainText('12:07 AM');
    await page.getByRole('button', { name: 'Create event link' }).click();
    const url = await page.getByRole('link', { name: 'Open event link' }).getAttribute('href');
    expect(decodeEvent(new URL(url).search).date.toISOString()).toBe('2026-05-01T00:07:00.000Z');
  });
});

test('invalid dates stay in the picker and can be corrected', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /^Event date and time/ });
  await trigger.click();
  const picker = page.getByRole('dialog');
  const date = picker.getByLabel('Date', { exact: true });
  const confirm = picker.getByRole('button', { name: 'Use date and time' });
  await date.fill('2028-02-30');
  await confirm.click();
  await expect(picker.getByRole('alert')).toContainText('Enter a valid date');
  await expect(date).toBeFocused();
  await date.fill('2028-02-29');
  await expect(picker.getByRole('radio', { name: '29 February 2028' })).toBeChecked();
  await confirm.click();
  await expect(picker).toBeHidden();
  await expect(trigger).toContainText('29 Feb 2028');
});
