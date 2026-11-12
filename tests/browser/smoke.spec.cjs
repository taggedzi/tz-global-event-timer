const { test, expect } = require('@playwright/test');
test('creates a link and displays the same event across viewer timezones', async ({ browser }) => {
  const failures = [];
  function watch(page) {
    page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && ['document','script','stylesheet','font'].includes(response.request().resourceType())) failures.push(response.url());
    });
    page.on('requestfailed', request => {
      if (['document','script','stylesheet','font'].includes(request.resourceType())) failures.push(request.url());
    });
  }
  const context = await browser.newContext({ timezoneId: 'America/New_York', locale: 'en-GB' });
  const page = await context.newPage();
  watch(page);
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('/');
  await page.locator('#newEvent').fill('2026-01-02T20:00');
  await page.locator('#newEventDesc').fill('Game night & friends 🎮');
  await page.locator('#create').click();
  const url = await page.locator('#link a').getAttribute('href');
  await page.evaluate(async () => { await document.fonts.ready; });
  expect(Date.parse(new URL(url).searchParams.get('date'))).toBe(Date.parse('2026-01-03T01:00:00Z'));
  const displays = [];
  for (const timezoneId of ['Europe/London', 'Asia/Kolkata']) {
    const viewer = await browser.newContext({ timezoneId, locale: 'en-GB' });
    const tab = await viewer.newPage();
    watch(tab);
    await tab.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await tab.clock.setFixedTime(new Date('2026-01-01T00:00:00Z'));
    await tab.goto(url);
    await expect(tab.locator('#eventDesc')).toHaveText('Game night & friends 🎮');
    displays.push(await tab.locator('#existingEventTime').innerText());
    await tab.clock.runFor(200);
    await expect(tab.locator('#days')).toHaveText('2');
    await expect(tab.locator('#hours')).toHaveText('1');
    await tab.evaluate(async () => { await document.fonts.ready; });
    await viewer.close();
  }
  expect(displays[0]).toContain('01:00:00');
  expect(displays[1]).toContain('06:30:00');
  await context.close();
  expect(failures).toEqual([]);
});
