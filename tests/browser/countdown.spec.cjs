const { test, expect } = require('@playwright/test');
test('countdown renders immediately, starts exactly, and recovers from a clock change', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.setFixedTime(new Date('2026-01-01T00:00:00Z'));
  await page.goto('/?date=2026-01-01T00:00:00.001Z');
  await expect(page.locator('#seconds')).toHaveText('1');
  await page.clock.setFixedTime(new Date('2026-01-01T00:00:00.001Z'));
  await page.clock.runFor(1000);
  await expect(page.locator('#existingEventHeader')).toContainText('already started');
  await expect(page.locator('#countdown')).toBeHidden();
  await page.clock.setFixedTime(new Date('2026-01-01T00:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#countdown')).toBeVisible();
  await expect(page.locator('#seconds')).toHaveText('1');
});
