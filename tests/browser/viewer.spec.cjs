const { test, expect } = require('@playwright/test');
const { readFile } = require('node:fs/promises');

test('event details appear below the controls, local time, and future countdown', async ({ page }) => {
  await page.clock.install({ time: new Date('2028-01-01T19:59:00Z') });
  await page.clock.pauseAt(new Date('2028-01-01T19:59:50Z'));
  await page.goto('/?date=2028-01-01T20:00:00Z&desc=Game+night');
  const countdown = page.locator('#countdown');
  const description = page.locator('#eventDesc');
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const actions = await page.getByRole('group', { name: 'Event actions' }).boundingBox();
    const time = await page.locator('.local-time').boundingBox();
    const remaining = await countdown.boundingBox();
    const text = await description.boundingBox();
    expect(actions.y + actions.height).toBeLessThanOrEqual(time.y);
    expect(time.y + time.height).toBeLessThanOrEqual(remaining.y);
    expect(remaining.y + remaining.height).toBeLessThanOrEqual(text.y);
  }
  await page.clock.fastForward(10_000);
  await expect(countdown).toBeHidden();
  await expect(description).toBeVisible();
});

test('event text exports use the displayed date and time and preserve the description', async ({ page }) => {
  const description = 'Game night 🎮\nBring snacks & drinks.';
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      async writeText(text) {
        if (window.denyCopy) throw new Error('Denied');
        window.lastCopied = text;
      }
    } });
    window.print = () => { window.printCalled = true; };
  });
  await page.goto('/?' + new URLSearchParams({ date: '2028-01-01T20:00:00Z', desc: description }));
  const zone = page.getByRole('combobox', { name: 'Display time zone' });
  await zone.selectOption('UTC');
  const expected = (await page.locator('#existingEventTime').textContent()) + '\n\n' + description;
  expect(expected).toMatch(/20:00:00 .*\(UTC\)/);

  const copy = page.getByRole('button', { name: 'Copy text' });
  await copy.click();
  await expect(page.locator('#eventCopyStatus')).toHaveText('Event text copied.');
  expect(await page.evaluate(() => window.lastCopied)).toBe(expected);

  await page.evaluate(() => { window.denyCopy = true; });
  await copy.click();
  const fallback = page.getByRole('textbox', { name: 'Event text', exact: true });
  await expect(fallback).toBeFocused();
  await expect(fallback).toHaveValue(expected);
  expect(await fallback.evaluate(el => el.selectionEnd - el.selectionStart)).toBe(expected.length);

  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: 'Download text' }).click()
  ]);
  expect(download.suggestedFilename()).toBe('event-details.txt');
  expect(await readFile(await download.path(), 'utf8')).toBe(expected);

  await page.getByRole('button', { name: 'Print event' }).click();
  expect(await page.evaluate(() => window.printCalled)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('main')).toBeHidden();
  const printText = page.locator('#eventPrintText');
  await expect(printText).toBeVisible();
  expect(await printText.textContent()).toBe(expected);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ media: 'screen' });
  await expect(printText).toBeHidden();
  await expect(copy).toBeVisible();
});

test('calendar export uses the event instant even after the event starts or the display zone changes', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2028-01-02T00:00:00Z'));
  const exportButton = page.getByRole('button', { name: 'Download calendar file (.ics)', exact: true });
  await page.goto('/');
  await expect(exportButton).toBeHidden();
  await page.goto('/?date=invalid');
  await expect(exportButton).toBeHidden();

  const description = 'Game night 🎮\nBring snacks & drinks.';
  await page.goto('/?' + new URLSearchParams({ date: '2028-01-01T20:00:00Z', desc: description }));
  await expect(page.getByText('Event has already started.')).toBeVisible();
  const zone = page.getByRole('combobox', { name: 'Display time zone' });
  await zone.selectOption('UTC');

  async function downloadCalendar() {
    const [download] = await Promise.all([page.waitForEvent('download'), exportButton.press('Enter')]);
    expect(download.suggestedFilename()).toBe('event.ics');
    return readFile(await download.path(), 'utf8');
  }

  const calendar = await downloadCalendar();
  expect(calendar).toContain('\r\nDTSTAMP:20280102T000000Z\r\n');
  expect(calendar).toContain('\r\nDTSTART:20280101T200000Z\r\n');
  expect(calendar).toContain('\r\nDESCRIPTION:Game night 🎮\\nBring snacks & drinks.\r\n');
  expect(calendar).toMatch(/\r\nUID:[0-9a-f]{32}\r\n/);

  await zone.selectOption('Asia/Tokyo');
  await expect(page.locator('#existingEventTime')).toContainText('05:00:00');
  expect(await downloadCalendar()).toBe(calendar);
});

test('a year beyond the calendar format shows an export error and keeps the viewer usable', async ({ page }) => {
  await page.goto('/?' + new URLSearchParams({ date: '+010000-01-01T00:00:00Z' }));
  await page.getByRole('button', { name: 'Download calendar file (.ics)', exact: true }).click();
  await expect(page.getByText('Could not download the calendar file. Calendar files require a four-digit year.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download text' })).toBeEnabled();
});

test('detected viewer zones handle year rollover, offsets, and manual override', async ({ browser }) => {
  for (const [timezoneId, year, hour] of [['America/New_York','2026','18:30:00'],['Europe/London','2026','23:30:00'],['Asia/Kolkata','2027','05:00:00']]) {
    const context = await browser.newContext({ timezoneId, locale: 'en-GB' });
    const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.clock.setFixedTime(new Date('2026-01-01T00:00:00Z'));
    await page.goto('/?' + new URLSearchParams({ date: '2026-12-31T23:30:00.000Z', zone: 'Europe/London' }));
    await expect(page.getByRole('heading', { name: 'Scheduled event' })).toBeVisible();
    await expect(page.locator('#displayTimeLabel')).toHaveText('The event in your local time');
    await expect(page.locator('#existingEventTime')).toContainText(year);
    await expect(page.locator('#existingEventTime')).toContainText(hour);
    const detectedZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    const zone = page.getByRole('combobox', { name: 'Display time zone' });
    await expect(zone).toHaveValue(detectedZone);
    await expect(page.locator('#existingEventTime')).toContainText(detectedZone);
    await page.clock.runFor(200);
    const countdown = await page.locator('#countdown').innerText();
    await zone.selectOption('UTC');
    await expect(page.locator('#displayTimeLabel')).toHaveText('Event time in selected zone');
    await expect(page.locator('#existingEventTime')).toContainText('23:30:00');
    await expect(page.locator('#existingEventTime')).toContainText('(UTC)');
    await expect(page.locator('#originEventTime')).toContainText('Europe/London');
    expect(await page.locator('#existingEventTime').getAttribute('data-instant')).toBe('2026-12-31T23:30:00.000Z');
    expect(await page.locator('#countdown').innerText()).toBe(countdown);
    await zone.selectOption({ label: `Your local time (${detectedZone})` });
    await expect(page.locator('#displayTimeLabel')).toHaveText('The event in your local time');
    await expect(page.locator('#existingEventTime')).toContainText(hour);
    await page.goto('/?date=2026-03-15T12:00:00.000Z');
    const springTime = timezoneId === 'America/New_York' ? '08:00:00' : timezoneId === 'Europe/London' ? '12:00:00' : '17:30:00';
    await expect(page.locator('#existingEventTime')).toContainText(springTime);
    await context.close();
  }
});
