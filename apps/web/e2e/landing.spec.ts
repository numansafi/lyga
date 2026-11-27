import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

test.describe('Landing Page (/)', () => {
  for (const vp of VIEWPORTS) {
    test(`renders cleanly with zero overflow or errors on ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      const serverErrors: number[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => consoleErrors.push(err.message));
      page.on('response', (res) => {
        if (res.status() >= 500) serverErrors.push(res.status());
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByRole('heading', { name: /DM yourself the important stuff/i })
      ).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow).toBe(false);
      expect(consoleErrors).toEqual([]);
      expect(serverErrors).toEqual([]);
    });
  }

  test('comparison tabs, FAQ accordion, and hero CTA work end-to-end', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Comparison tabs
    const emailTab = page.getByRole('tab', { name: /vs\. Email/i });
    await emailTab.click();
    await expect(emailTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Lost in your inbox')).toBeVisible();

    const appsTab = page.getByRole('tab', { name: /vs\. Sharing apps/i });
    await appsTab.click();
    await expect(appsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Gone after one transfer')).toBeVisible();

    // FAQ accordion
    const installFaq = page.getByRole('button', {
      name: /Do I have to install an app on my computer/i,
    });
    await installFaq.click();
    await expect(installFaq).toHaveAttribute('aria-expanded', 'true');

    // Hero CTA navigates to /login
    await page.getByRole('button', { name: /Get started free/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
