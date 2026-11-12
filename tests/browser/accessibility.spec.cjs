const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
test('layout reflows at narrow widths with long descriptions and links', async ({ page }) => {
  for (const width of [320,375,1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?' + new URLSearchParams({ date: '2028-01-01T20:00:00.000Z', desc: 'Game night 🎮 '.repeat(40) }));
    await page.locator('#newEvent').fill('2028-01-01T20:00');
    await page.locator('#newEventDesc').fill('A very long event description 🎮 '.repeat(20));
    await page.locator('#create').click();
    const sizes = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await page.goto('/?' + new URLSearchParams({ date: '2028-01-01T20:00:00.000Z', desc: 'Game night with friends 🎮', zone: 'Europe/London' }));
    await page.locator('#newEvent').fill('2028-01-01T20:00');
    await page.locator('#newEventDesc').fill('Game night with friends');
    await page.locator('#create').click();
    await page.screenshot({ path: 'test-results/layout-' + width + '.png', fullPage: true });
  }
});
test('labels, keyboard submission, and error focus are usable', async ({ page }) => {
  await page.goto('/');
  await page.locator('#create').click();
  await expect(page.getByLabel('Event date and time in the selected timezone')).toBeFocused();
  await expect(page.locator('#formError')).toContainText('Select');
  await page.getByLabel('Event timezone', { exact: true }).fill('UTC');
  await page.getByLabel('Event date and time in the selected timezone').fill('2028-01-01T20:00');
  await page.getByLabel('Description (optional)').fill('Keyboard event');
  await page.getByLabel('Description (optional)').press('Enter');
  await expect(page.locator('#link a')).toBeVisible();
  await page.getByLabel('Description (optional)').press('Tab');
  await expect(page.getByRole('button', { name: 'Create event link', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Shareable link')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#link a')).toBeFocused();
  const outline = await page.locator('#link a').evaluate(el => getComputedStyle(el).outlineStyle);
  expect(outline).toBe('solid');
  await page.locator('#eventZone').fill('America/New_York');
  await page.locator('#newEvent').fill('2026-11-01T01:30');
  await page.locator('#create').click();
  await expect(page.locator('#occurrence')).toBeFocused();
  await page.locator('#occurrence').press('ArrowDown');
  await page.locator('#occurrence').press('Tab');
  await page.getByLabel('Description (optional)').press('Enter');
  await expect(page.locator('#link a')).toBeVisible();
});
