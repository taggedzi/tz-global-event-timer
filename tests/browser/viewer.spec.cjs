const { test, expect } = require('@playwright/test');
test('detected viewer zones handle year rollover, offsets, and manual override', async ({ browser }) => {
  for (const [timezoneId, year, hour] of [['America/New_York','2026','18:30:00'],['Europe/London','2026','23:30:00'],['Asia/Kolkata','2027','05:00:00']]) {
    const context = await browser.newContext({ timezoneId, locale: 'en-GB' });
    const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.clock.setFixedTime(new Date('2026-01-01T00:00:00Z'));
    await page.goto('/?' + new URLSearchParams({ date: '2026-12-31T23:30:00.000Z', zone: 'Europe/London' }));
    await expect(page.getByRole('heading', { name: 'Scheduled event' })).toBeVisible();
    await expect(page.locator('#displayTimeLabel')).toHaveText('Your local time');
    await expect(page.locator('#existingEventTime')).toContainText(year);
    await expect(page.locator('#existingEventTime')).toContainText(hour);
    const detectedZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    await expect(page.locator('#viewerZone')).toHaveValue(detectedZone);
    await expect(page.locator('#existingEventTime')).toContainText(detectedZone);
    await page.clock.runFor(200);
    const countdown = await page.locator('#countdown').innerText();
    await page.locator('#viewerZone').fill('UTC');
    await page.locator('#viewerZone').press('Tab');
    await expect(page.locator('#displayTimeLabel')).toHaveText('Event time in selected zone');
    await expect(page.locator('#existingEventTime')).toContainText('23:30:00');
    await expect(page.locator('#existingEventTime')).toContainText('(UTC)');
    await expect(page.locator('#originEventTime')).toContainText('Europe/London');
    expect(await page.locator('#existingEventTime').getAttribute('data-instant')).toBe('2026-12-31T23:30:00.000Z');
    expect(await page.locator('#countdown').innerText()).toBe(countdown);
    await page.goto('/?date=2026-03-15T12:00:00.000Z');
    const springTime = timezoneId === 'America/New_York' ? '08:00:00' : timezoneId === 'Europe/London' ? '12:00:00' : '17:30:00';
    await expect(page.locator('#existingEventTime')).toContainText(springTime);
    await context.close();
  }
});
