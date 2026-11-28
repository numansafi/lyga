import { expect, test } from '@playwright/test';

test.describe('6-Digit Sync PIN & 1-Tap Device Approval E2EE Flow', () => {
  test('sets mandatory 6-digit Sync PIN, unlocks new browser, and rotates PIN', async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const email = `e2e-pin-${Date.now()}@lyga.app`;

    const context1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page1 = await context1.newPage();

    await page1.goto('/login');
    const auth1 = await page1.request.post('/api/auth/session', { data: { devEmail: email } });
    expect(auth1.status()).toBe(200);
    await page1.goto('/app');

    // Mandatory 6-digit Sync PIN banner appears with no dismiss button
    const pinInput = page1.getByPlaceholder('Create a 6-digit Sync PIN');
    await expect(pinInput).toBeVisible();
    await expect(page1.getByRole('button', { name: 'Dismiss Sync PIN prompt' })).toHaveCount(0);

    // Eye toggle switches masked input to text and back
    await page1.getByRole('button', { name: 'Show Sync PIN' }).click();
    await expect(pinInput).toHaveAttribute('type', 'text');
    await page1.getByRole('button', { name: 'Hide Sync PIN' }).click();
    await expect(pinInput).toHaveAttribute('type', 'password');

    await pinInput.fill('482915');
    await page1.getByRole('button', { name: 'Save Sync PIN' }).click();
    await expect(page1.getByText(/6-digit Sync PIN saved/i)).toBeVisible();
    await expect(pinInput).toHaveCount(0);

    // Send an encrypted note
    const secretNote = `Pin-protected note ${Date.now()}`;
    await page1.getByLabel('Send a note, link, or file').fill(secretNote);
    await page1.getByRole('button', { name: 'Send message' }).click();
    await expect(page1.getByText(secretNote)).toBeVisible();

    // Browser 2 (fresh IndexedDB) unlocks using the 6-digit Sync PIN
    const context2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page2 = await context2.newPage();
    await page2.goto('/login');
    const auth2 = await page2.request.post('/api/auth/session', { data: { devEmail: email } });
    expect(auth2.status()).toBe(200);
    await page2.goto('/app');

    const unlockPinInput = page2.getByPlaceholder('Enter your 6-digit Sync PIN');
    await expect(unlockPinInput).toBeVisible();
    await expect(page2.getByText(secretNote)).toHaveCount(0);

    await unlockPinInput.fill('482915');
    await page2.getByRole('button', { name: 'Unlock' }).click();
    await expect(page2.getByText(secretNote)).toBeVisible();

    // Browser 1 can rotate the Sync PIN from Account Menu
    await page1.getByRole('button', { name: 'Account menu' }).click();
    await page1.getByRole('menuitem', { name: 'Change Sync PIN' }).click();
    await page1.getByPlaceholder('Enter new 6-digit Sync PIN').fill('739204');
    await page1.getByRole('button', { name: 'Save 6-digit Sync PIN' }).click();
    await expect(page1.getByText(/6-digit Sync PIN updated/i)).toBeVisible();

    await context2.close();
    await context1.close();
  });

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
