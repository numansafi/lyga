import { expect, test } from '@playwright/test';

test.describe('Auth Guards & E2EE Key Discipline', () => {
  test('unauthenticated /app redirects to /login and protected APIs return 401', async ({
    page,
    request,
  }) => {
    for (const endpoint of [
      '/api/mvp/workspace',
      '/api/mvp/download-url?id=test',
    ]) {
      const res = await request.get(endpoint);
      expect(res.status()).toBe(401);
    }

    const postRes = await request.post('/api/mvp/items', {
      data: { kind: 'text', encryptedMeta: 'x' },
    });
    expect(postRes.status()).toBe(401);

    const blobPutRes = await request.put('/api/mvp/blobs/ws_1234567890abcdef', {
      data: Buffer.from('abc'),
    });
    expect(blobPutRes.status()).toBe(401);

    await page.goto('/app');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('/login renders QR pairing card cleanly on desktop and mobile', async ({ page }) => {
    const consoleErrors: string[] = [];
    const leakedFragments: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('401 (Unauthorized)')) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('request', (req) => {
      if (/#(wmk|k)=/i.test(req.url())) {
        leakedFragments.push(req.url());
      }
    });

    for (const vp of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(vp);
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (vp.width >= 1024) {
        await expect(page.getByText(/Scan with your phone/i)).toBeVisible();
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow).toBe(false);
    }

    expect(leakedFragments).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
