import { expect, test } from '@playwright/test';

test.describe('1-Tap Device Approval E2EE Flow', () => {
  test('unlocks a second browser via 1-tap ECDH device approval', async ({ browser }) => {
    test.setTimeout(60_000);
    const email = `e2e-approve-${Date.now()}@lyga.app`;

    const context1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page1 = await context1.newPage();
    await page1.goto('/login');
    const auth1 = await page1.request.post('/api/auth/session', { data: { devEmail: email } });
    expect(auth1.status()).toBe(200);
    await page1.goto('/app');

    const secretNote = `ECDH-approved note ${Date.now()}`;
    await page1.getByLabel('Send a note, link, or file').fill(secretNote);
    await page1.getByRole('button', { name: 'Send message' }).click();
    await expect(page1.getByText(secretNote)).toBeVisible();

    // Browser 2 (fresh IndexedDB) requests 1-Tap ECDH approval
    const context2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page2 = await context2.newPage();
    await page2.goto('/login');
    const auth2 = await page2.request.post('/api/auth/session', { data: { devEmail: email } });
    expect(auth2.status()).toBe(200);
    await page2.goto('/app');

    await page2.getByRole('button', { name: '1-Tap Approve from Paired Device' }).click();
    await expect(page2.getByText(/Waiting for approval on your other device/i)).toBeVisible();

    // Browser 1 sees the live approval banner and approves
    const approveBtn = page1.getByRole('button', { name: 'Approve' });
    await expect(approveBtn).toBeVisible({ timeout: 10_000 });
    await approveBtn.click();

    // Browser 2 unlocks automatically and decrypts the note
    await expect(page2.getByText(secretNote)).toBeVisible({ timeout: 10_000 });

    await context2.close();
    await context1.close();
  });
});
