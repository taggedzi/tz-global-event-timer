const { test, expect } = require('@playwright/test');
test('creates a link and displays the same event across viewer timezones', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'America/New_York', locale: 'en-GB' });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('/');
  await page.locator('#newEvent').evaluate(el => el._flatpickr.setDate(new Date(2026, 0, 2, 20, 0), true));
  await page.locator('#newEventDesc').fill('Game night & friends 🎮');
  await page.locator('#create').click();
  const url = await page.locator('#link a').getAttribute('href');
  expect(Date.parse(new URL(url).searchParams.get('date'))).toBe(Date.parse('2026-01-03T01:00:00Z'));
  const displays = [];
  for (const timezoneId of ['Europe/London', 'Asia/Kolkata']) {
    const viewer = await browser.newContext({ timezoneId, locale: 'en-GB' });
    const tab = await viewer.newPage();
    await tab.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await tab.clock.setFixedTime(new Date('2026-01-01T00:00:00Z'));
    await tab.goto(url);
    await expect(tab.locator('#eventDesc')).toHaveText('Game night & friends 🎮');
    displays.push(await tab.locator('#existingEventTime').innerText());
    await tab.clock.runFor(200);
    await expect(tab.locator('#days')).toHaveText('2');
    await expect(tab.locator('#hours')).toHaveText('1');
    await viewer.close();
  }
  expect(displays[0]).toContain('01:00:00');
  expect(displays[1]).toContain('06:30:00');
  await context.close();
});
