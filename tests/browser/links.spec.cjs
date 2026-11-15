const { test, expect } = require('@playwright/test');
const { readFile } = require('node:fs/promises');
const { webcrypto } = require('node:crypto');
const { encodeProtectedEventUrl } = require('../../src/js/event-link');
const { selectDateTime } = require('./date-time-picker.cjs');

async function enablePasswordProtection(page) {
  // Exercise the setting that webpack writes, using the production bundle for both modes.
  await page.route(url => url.pathname === '/', async route => {
    const response = await route.fetch();
    const html = await response.text();
    const body = html.replace(/\bdata-password-protection=(?:"false"|false)(?=[\s>])/, 'data-password-protection="true"');
    await route.fulfill({ response, body });
  });
}

async function copyLinkWithNotice(page, url) {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async text => { window.lastCopied = text; } }
    });
  });
  await expect(page.locator('#shareNotice')).toBeVisible();
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.locator('#copyStatus')).toHaveText('Link copied.');
  expect(await page.evaluate(() => window.lastCopied)).toBe(url.href);
  await expect(page.locator('#shareNotice')).toBeVisible();
}

test('event QR code can be downloaded and printed, and is cleared when the link changes', async ({ page }) => {
  await page.goto('/');
  await page.locator('#eventZone').fill('Europe/London');
  await selectDateTime(page, '2030-07-01T20:00');
  await page.locator('#create').click();

  const generate = page.getByRole('button', { name: 'Generate QR code' });
  const image = page.getByRole('img', { name: 'QR code for the event link' });
  await generate.click();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('#shareNotice')).toBeVisible();
  await expect(page.getByLabel('Shareable link')).toHaveAccessibleDescription(/Public links may appear in hosting logs/);
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

for (const passwordProtection of ['disabled', 'enabled']) {
  test('public links support both formats and show notices with password protection ' + passwordProtection, async ({ page }) => {
    if (passwordProtection === 'enabled') await enablePasswordProtection(page);
    await page.goto('/');
    const compression = page.getByRole('checkbox', { name: 'Compress event link' });
    await expect(compression).toBeChecked();
    await expect(page.locator('#createNotice')).toBeVisible();
    await expect(page.getByLabel('Description (optional)')).toHaveAccessibleDescription(/Leave secrets and sensitive information out/);
    await page.locator('#eventZone').fill('Europe/London');
    await selectDateTime(page, '2030-07-01T20:00');
    const description = 'Game night 🎮 <img src=x onerror=alert(1)> & snacks. '.repeat(20).trim();
    await page.locator('#newEventDesc').fill(description);
    await page.locator('#create').click();
    const compressed = new URL(await page.locator('#shareUrl').inputValue());
    expect(compressed.search).toMatch(/^\?v1=[\w-]+$/);
    expect(compressed.hash).toBe('');
    await copyLinkWithNotice(page, compressed);

    await compression.uncheck();
    await expect(page.locator('#linkContainer')).toBeHidden();
    await page.locator('#create').click();
    const plain = new URL(await page.locator('#shareUrl').inputValue());
    expect(plain.searchParams.get('desc')).toBe(description);
    expect(plain.hash).toBe('');
    expect(compressed.href.length).toBeLessThan(plain.href.length);
    await copyLinkWithNotice(page, plain);

    for (const url of [compressed, plain]) {
      await page.goto(url.href);
      await expect(page.locator('#existingEventTime')).toHaveAttribute('data-instant', '2030-07-01T19:00:00.000Z');
      await expect(page.locator('#originEventTime')).toContainText('Europe/London');
      await expect(page.locator('#eventDesc')).toHaveText(description);
      await expect(page.locator('#eventDesc img')).toHaveCount(0);
      await expect(page.locator('#eventSourceNotice')).toBeVisible();
      await expect(page.locator('#countdownNotice')).toBeVisible();
    }
    await page.reload();
    await expect(page.locator('#createNotice')).toBeVisible();
    await expect(page.locator('#eventSourceNotice')).toBeVisible();
    await expect(page.locator('#countdownNotice')).toBeVisible();
  });
}

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

test('the default build omits password controls and rejects protected links', async ({ page, baseURL }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-password-protection', 'false');
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  const url = await encodeProtectedEventUrl({ date: new Date('2030-01-01T00:00:00Z') }, baseURL, {
    password: 'test password', crypto: webcrypto
  });
  await page.goto(url);
  await expect(page.locator('#linkError')).toHaveText(/configured with a password.*site owner has disabled password protection/);
  await expect(page.locator('input[type="password"], #unlockEventForm')).toHaveCount(0);
  await expect(page.locator('#passwordHelp, #officialAddressNotice')).toHaveCount(0);
  await expect(page.locator('#existingEventTimer')).toBeHidden();
  await expect(page.locator('#create')).toBeVisible();
});

test('when enabled, password protected links hide the event until unlocked and reject tampering', async ({ page }) => {
  const description = 'Private demo 🎮 <img src=x onerror=alert(1)>';
  const password = 'plum lantern comet moss';
  await enablePasswordProtection(page);
  await page.goto('/');
  await page.locator('#eventZone').fill('Europe/London');
  await selectDateTime(page, '2030-07-01T20:00');
  await page.locator('#newEventDesc').fill(description);
  await expect(page.locator('#createNotice')).toBeVisible();
  await expect(page.getByLabel('Protect with a password (optional)')).toHaveAccessibleDescription(/Leave blank to create a public link.*password guesses offline.*separate channel/);
  await page.getByLabel('Protect with a password (optional)').fill(password);
  await page.getByRole('button', { name: 'Create event link' }).click();
  const openLink = page.getByRole('link', { name: 'Open event link' });
  await expect(openLink).toBeVisible();
  const url = new URL(await page.locator('#shareUrl').inputValue());
  await copyLinkWithNotice(page, url);
  expect(url.search).toBe('');
  expect(url.hash).toMatch(/^#p1=[\w-]+$/);
  expect(url.href).not.toContain(encodeURIComponent(password));
  expect(url.href).not.toContain(encodeURIComponent('2030-07-01T19:00:00.000Z'));

  await openLink.click();
  const unlock = page.getByLabel('Event password', { exact: true });
  const timer = page.locator('#existingEventTimer');
  const calendarButton = page.getByRole('button', { name: 'Download calendar file (.ics)', exact: true });
  await expect(unlock).toBeVisible();
  await expect(page.locator('#lockedSourceNotice')).toBeVisible();
  const addressLink = page.getByRole('link', { name: 'official addresses in the project repository' });
  await expect(addressLink).toHaveAttribute(
    'href', 'https://github.com/taggedzi/tz-global-event-timer#official-addresses'
  );
  await expect(unlock).toHaveAccessibleDescription(/Confirm unexpected details.*Before entering a password/);
  await addressLink.focus();
  await page.keyboard.press('Tab');
  await expect(unlock).toBeFocused();
  await expect(timer).toBeHidden();
  await expect(calendarButton).toBeHidden();
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
  await expect(page.locator('#eventSourceNotice')).toBeVisible();
  await expect(page.locator('#countdownNotice')).toBeVisible();
  await expect(page.locator('#eventDesc')).toHaveText(description);
  await expect(page.locator('#eventDesc img')).toHaveCount(0);
  await expect(page.locator('#existingEventTime')).toHaveAttribute('data-instant', '2030-07-01T19:00:00.000Z');
  await expect(page.locator('#originEventTime')).toContainText('Europe/London');
  const [download] = await Promise.all([page.waitForEvent('download'), calendarButton.click()]);
  expect(download.suggestedFilename()).toBe('event.ics');
  const calendar = await readFile(await download.path(), 'utf8');
  expect(calendar).toContain('\r\nDTSTART:20300701T190000Z\r\n');
  expect(calendar).toContain('\r\nDESCRIPTION:' + description + '\r\n');
  expect(calendar).not.toContain(password);
  expect(calendar).not.toContain(url.hash);

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
