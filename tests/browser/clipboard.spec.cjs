const { test, expect } = require('@playwright/test');
test('copy succeeds only after confirmation and recovers through a keyboard-selectable URL', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true,
    value: { writeText: async text => { window.lastCopied = text; throw new Error('Denied'); } } }));
  await page.goto('/');
  await page.locator('#newEvent').fill('2028-01-01T20:00');
  await page.locator('#newEventDesc').fill('Game night 🎮 & friends');
  await page.locator('#create').click();
  await page.getByRole('button', { name: 'Copy link', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#copyStatus')).toContainText('manually');
  await expect(page.getByLabel('Shareable link')).toBeFocused();
  expect(await page.getByLabel('Shareable link').evaluate(el => el.selectionEnd - el.selectionStart)).toBe((await page.getByLabel('Shareable link').inputValue()).length);
  await page.evaluate(() => { navigator.clipboard.writeText = async text => { window.lastCopied = text; }; });
  await page.locator('#copyUrl').click();
  await expect(page.locator('#copyStatus')).toHaveText('Link copied.');
  expect(await page.evaluate(() => window.lastCopied)).toBe(await page.getByLabel('Shareable link').inputValue());
  await page.locator('#newEventDesc').fill('Changed event');
  await expect(page.locator('#linkContainer')).toBeHidden();
  await expect(page.locator('#copyUrl')).toBeDisabled();
});
