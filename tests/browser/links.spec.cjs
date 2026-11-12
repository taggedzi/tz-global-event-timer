const { test, expect } = require('@playwright/test');

test('event QR code can be downloaded and printed, and is cleared when the link changes', async ({ page }) => {
  await page.goto('/');
  await page.locator('#eventZone').fill('Europe/London');
  await page.locator('#newEvent').fill('2030-07-01T20:00');
  await page.locator('#create').click();

  const generate = page.getByRole('button', { name: 'Generate QR code' });
  const image = page.getByRole('img', { name: 'QR code for the event link' });
  await generate.click();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  const downloadLink = page.getByRole('link', { name: 'Download QR code (PNG)' });
  const [download] = await Promise.all([page.waitForEvent('download'), downloadLink.click()]);
  expect(download.suggestedFilename()).toBe('event-qr-code.png');
  expect(await download.failure()).toBeNull();

  await page.evaluate(() => { window.print = () => { document.body.dataset.printed = 'true'; }; });
  await page.getByRole('button', { name: 'Print QR code' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-printed', 'true');
  await page.emulateMedia({ media: 'print' });
  await expect(image).toBeVisible();
  await expect(downloadLink).toBeHidden();
  await expect(page.locator('#newEventContainer')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  await page.locator('#compressLink').uncheck();
  await expect(image).toBeHidden();
  await page.locator('#newEventDesc').fill('x'.repeat(3000));
  await page.locator('#create').click();
  await generate.click();
  await expect(page.locator('#qrError')).toContainText('too long for a QR code');
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeEnabled();
  await expect(image).toBeHidden();
});

test('compression is on by default and can be turned off', async ({ page }) => {
  await page.goto('/');
  const compression = page.getByRole('checkbox', { name: 'Compress event link' });
  await expect(compression).toBeChecked();
  await page.locator('#eventZone').fill('Europe/London');
  await page.locator('#newEvent').fill('2030-07-01T20:00');
  const description = 'Game night 🎮 <img src=x onerror=alert(1)> & snacks. '.repeat(20).trim();
  await page.locator('#newEventDesc').fill(description);
  await page.locator('#create').click();
  const compressed = new URL(await page.locator('#shareUrl').inputValue());
  expect(compressed.search).toMatch(/^\?v1=[\w-]+$/);

  await compression.uncheck();
  await expect(page.locator('#linkContainer')).toBeHidden();
  await page.locator('#create').click();
  const plain = new URL(await page.locator('#shareUrl').inputValue());
  expect(plain.searchParams.get('desc')).toBe(description);
  expect(compressed.href.length).toBeLessThan(plain.href.length);

  await page.goto(compressed.href);
  await expect(page.locator('#existingEventTime')).toHaveAttribute('data-instant', '2030-07-01T19:00:00.000Z');
  await expect(page.locator('#originEventTime')).toContainText('Europe/London');
  await expect(page.locator('#eventDesc')).toHaveText(description);
  await expect(page.locator('#eventDesc img')).toHaveCount(0);
});

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
