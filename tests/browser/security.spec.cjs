const { test, expect } = require('@playwright/test');

test('preview survives malformed paths and sends security headers', async ({ request }) => {
  for (const path of ['/index.html%00.js', '/bad%zz', '/..%2fpackage.json']) {
    expect((await request.get(path)).status()).toBe(400);
  }
  const page = await request.get('/');
  expect(page.ok()).toBe(true);
  expect(page.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(page.headers()['referrer-policy']).toBe('no-referrer');
  expect(page.headers()['x-content-type-options']).toBe('nosniff');
});

test('static HTML alone blocks inline scripts while the event app runs', async ({ page }) => {
  await page.route(/\/$/, async route => {
    const response = await route.fetch();
    const headers = response.headers();
    delete headers['content-security-policy'];
    delete headers['referrer-policy'];
    await route.fulfill({ response, headers });
  });
  await page.goto('/');
  await expect(page.locator('#timeZones option').first()).toBeAttached();
  expect(await page.locator('meta[name="referrer"]').getAttribute('content')).toBe('no-referrer');

  await page.evaluate(() => {
    document.addEventListener('securitypolicyviolation', event => {
      document.body.dataset.blockedUri = event.blockedURI;
    }, { once: true });
    const script = document.createElement('script');
    script.textContent = 'document.body.dataset.inlineScriptRan = "yes";';
    document.head.appendChild(script);
  });
  await expect(page.locator('body')).toHaveAttribute('data-blocked-uri', 'inline');
  await expect(page.locator('body')).not.toHaveAttribute('data-inline-script-ran', 'yes');
});
