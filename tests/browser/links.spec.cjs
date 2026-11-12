const { test, expect } = require('@playwright/test');
test('new and legacy links display safely and invalid links recover', async ({ page }) => {
  for (const date of ['2026-12-01T20:00:00.000Z', 'Tue, 01 Dec 2026 20:00:00 GMT']) {
    await page.goto('/?' + new URLSearchParams({ date, desc: '<img src=x onerror=alert(1)> 🎮' }));
    await expect(page.locator('#eventDesc')).toHaveText('<img src=x onerror=alert(1)> 🎮');
    await expect(page.locator('#eventDesc img')).toHaveCount(0);
    await expect(page.locator('#existingEventTime')).not.toContainText('Invalid');
  }
  await page.goto('/?date=bad');
  await expect(page.locator('#linkError')).toContainText('invalid date');
  await expect(page.locator('#existingEventTimer')).toBeHidden();
  await page.locator('#create').click();
  await expect(page.locator('#formError')).toContainText('Select');
});
