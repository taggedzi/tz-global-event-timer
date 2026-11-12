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

test('password protected links hide the event until unlocked and reject tampering', async ({ page }) => {
  const description = 'Private demo 🎮 <img src=x onerror=alert(1)>';
  const password = 'plum lantern comet moss';
  await page.goto('/');
  await page.locator('#eventZone').fill('Europe/London');
  await page.locator('#newEvent').fill('2030-07-01T20:00');
  await page.locator('#newEventDesc').fill(description);
  await page.getByLabel('Protect with a password (optional)').fill(password);
  await expect(page.locator('#passwordHelp')).toContainText('offline');
  await page.getByRole('button', { name: 'Create event link' }).click();
  const openLink = page.getByRole('link', { name: 'Open event link' });
  await expect(openLink).toBeVisible();
  const url = new URL(await page.locator('#shareUrl').inputValue());
  expect(url.search).toBe('');
  expect(url.hash).toMatch(/^#p1=[\w-]+$/);
  expect(url.href).not.toContain(encodeURIComponent(password));
  expect(url.href).not.toContain(encodeURIComponent('2030-07-01T19:00:00.000Z'));

  await openLink.click();
  const unlock = page.getByLabel('Event password', { exact: true });
  const timer = page.locator('#existingEventTimer');
  await expect(unlock).toBeVisible();
  await expect(timer).toBeHidden();
  await expect(page.locator('#eventDesc')).toBeEmpty();
  await expect(page.locator('#newEventDesc')).toHaveValue('');
  await unlock.fill('wrong password');
  await unlock.press('Enter');
  await expect(page.locator('#unlockError')).toContainText('Check the password');
  await expect(timer).toBeHidden();
  await unlock.fill(password);
  await unlock.press('Enter');
  await expect(timer).toBeVisible();
  await expect(unlock).toBeHidden();
  await expect(page.locator('#eventDesc')).toHaveText(description);
  await expect(page.locator('#eventDesc img')).toHaveCount(0);
  await expect(page.locator('#existingEventTime')).toHaveAttribute('data-instant', '2030-07-01T19:00:00.000Z');
  await expect(page.locator('#originEventTime')).toContainText('Europe/London');

  // Change one character within the ciphertext while keeping the URL well formed.
  const offset = 50;
  url.hash = url.hash.slice(0, offset) + (url.hash[offset] === 'A' ? 'B' : 'A') + url.hash.slice(offset + 1);
  await page.goto(url.href);
  await expect(unlock).toBeVisible();
  await expect(timer).toBeHidden();
  await unlock.fill(password);
  await unlock.press('Enter');
  await expect(page.locator('#unlockError')).toContainText('Could not unlock');
  await expect(timer).toBeHidden();
  await expect(page.locator('#eventDesc')).toBeEmpty();
});
