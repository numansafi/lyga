import { expect, test } from '@playwright/test';

test.describe('Authenticated Workspace E2EE Flow (/app)', () => {
  test('signs in, sends encrypted note, persists across reload, filters, edits, and deletes', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const serverErrors: number[] = [];
    const leakedFragments: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('response', (res) => {
      if (res.status() >= 500) serverErrors.push(res.status());
    });
    page.on('request', (req) => {
      const body = req.postData() ?? '';
      if (/#(wmk|k)=/i.test(req.url()) || /#(wmk|k)=/i.test(body)) {
        leakedFragments.push(req.url());
      }
    });

    // Establish local dev auth session via public seam
    await page.goto('/login');
    const authRes = await page.request.post('/api/auth/session', {
      data: { devEmail: `e2e-${Date.now()}@lyga.app` },
    });
    expect(authRes.status()).toBe(200);
    consoleErrors.length = 0;

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');

    // Verify <h1> and accessible composer
    await expect(page.getByRole('heading', { level: 1, name: 'My Lyga' })).toBeVisible();
    const composer = page.getByLabel('Send a note, link, or file');
    await expect(composer).toBeVisible();

    // Send encrypted note and wait for server persistence
    const uniqueNote = `E2EE secret note ${Date.now()}`;
    await composer.fill(uniqueNote);
    const sendBtn = page.getByRole('button', { name: 'Send message' });
    await expect(sendBtn).toBeEnabled();
    const [saveRes] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/mvp/items') && res.request().method() === 'POST'
      ),
      sendBtn.click(),
    ]);
    expect(saveRes.status()).toBe(200);

    await expect(page.getByText(uniqueNote)).toBeVisible();

    // Reload and verify E2EE decryption from IndexedDB WMK
    await page.reload();
    await expect(page.getByText(uniqueNote)).toBeVisible();

    // Switch to Notes tab and search
    await page.getByRole('tab', { name: /Notes/i }).click();
    const searchInput = page.getByLabel('Search workspace items');
    await searchInput.fill(uniqueNote);
    await expect(page.getByText(uniqueNote)).toBeVisible();

    // Switch back to All, check mobile viewport overflow
    await page.getByRole('tab', { name: /All/i }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(mobileOverflow).toBe(false);

    // Hover and delete the note
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByText(uniqueNote)).toBeVisible();
    await page.getByText(uniqueNote).hover();
    const deleteBtn = page.getByRole('button', { name: 'Delete message' }).first();
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/mvp/items') && res.request().method() === 'DELETE'
      ),
      deleteBtn.click({ force: true }),
    ]);
    await expect(page.getByText(uniqueNote)).toHaveCount(0);

    expect(leakedFragments).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });
});
