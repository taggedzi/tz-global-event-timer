const { test, expect } = require('@playwright/test');
const { selectDateTime } = require('./date-time-picker.cjs');
const { AxeBuilder } = require('@axe-core/playwright');
test('layout reflows at narrow widths with long descriptions and links', async ({ page }) => {
  for (const width of [320,375,1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?' + new URLSearchParams({ date: '2028-01-01T20:00:00.000Z', desc: 'Game night 🎮 '.repeat(40) }));
    await selectDateTime(page, '2028-01-01T20:00');
    await page.locator('#newEventDesc').fill('A very long event description 🎮 '.repeat(20));
    await page.locator('#create').click();
    const sizes = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await page.goto('/?' + new URLSearchParams({ date: '2028-01-01T20:00:00.000Z', desc: 'Game night with friends 🎮', zone: 'Europe/London' }));
    await selectDateTime(page, '2028-01-01T20:00');
    await page.locator('#newEventDesc').fill('Game night with friends');
    await page.locator('#create').click();
    await page.screenshot({ path: 'test-results/layout-' + width + '.png', fullPage: true });
  }
});
test('labels, keyboard submission, and error focus are usable', async ({ page }) => {
  await page.goto('/');
  await page.locator('#create').click();
  await expect(page.getByRole('button', { name: /^Event date and time/ })).toBeFocused();
  await expect(page.locator('#formError')).toContainText('Select');
  await page.getByLabel('Event time zone', { exact: true }).fill('UTC');
  await selectDateTime(page, '2028-01-01T20:00');
  const description = page.getByLabel('Description (optional)');
  await description.fill('Keyboard event');
  await description.press('End');
  await description.press('Enter');
  await expect(description).toHaveValue('Keyboard event\n');
  await expect(page.locator('#descriptionRemaining')).toHaveText('4,081 bytes left');
  await expect(page.locator('#link a')).toBeHidden();
  await description.press('Tab');
  await expect(page.getByRole('checkbox', { name: 'Compress event link' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Create event link', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#link a')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Shareable link')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#link a')).toBeFocused();
  const outline = await page.locator('#link a').evaluate(el => getComputedStyle(el).outlineStyle);
  expect(outline).toBe('solid');
  await page.locator('#eventZone').fill('America/New_York');
  await selectDateTime(page, '2026-11-01T01:30');
  await page.locator('#create').click();
  await expect(page.locator('#occurrence')).toBeFocused();
  await page.locator('#occurrence').press('ArrowDown');
  await page.locator('#occurrence').press('Tab');
  await expect(description).toBeFocused();
  await description.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('#link a')).toBeVisible();
});

test('the official addresses and reporting paths are visible from the timer', async ({ page }) => {
  await page.goto('/#official-addresses');
  const official = page.locator('#official-addresses');
  await expect(official.getByRole('heading', { name: 'Official addresses' })).toBeVisible();
  const addresses = await official.getByRole('list').getByRole('link').evaluateAll(links => links.map(link => link.href));
  expect(addresses).toEqual(['https://taggedzi.github.io/tz-global-event-timer/', 'https://timer.taggedz.me/']);
  await expect(official.getByRole('link', { name: 'project README' })).toHaveAttribute(
    'href', 'https://github.com/taggedzi/tz-global-event-timer#official-addresses'
  );
  await expect(official.getByRole('link', { name: 'GitHub issue', exact: true })).toHaveAttribute(
    'href', 'https://github.com/taggedzi/tz-global-event-timer/issues/new/choose'
  );
  await expect(official.getByRole('link', { name: 'private vulnerability reporting' })).toHaveAttribute(
    'href', 'https://github.com/taggedzi/tz-global-event-timer/security/advisories/new'
  );
});
