import { expect, test } from './fixtures';

/**
 * The brightness control.
 *
 * The point of these is the two things a theme gets wrong most often: the
 * choice not surviving a page change, and the page painting white for a frame
 * before the stored choice is applied — which is exactly the flash the shop
 * asked to be rid of.
 */

test('a chosen tone is applied, remembered, and carried across pages', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'เปลี่ยนโทนสีเว็บ' }).click();
  await page.getByRole('menuitemradio', { name: /นวลตา/ }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'soft');

  await page.goto('/menu');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'soft');
});

test('a stored dark choice is on the page before it paints', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('imjai-theme', 'dark');
    } catch {
      // Storage unavailable: the assertion below will say so.
    }
  });

  // Read at DOMContentLoaded rather than after load: an attribute applied by
  // React on hydration would arrive later than this and show a white flash.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const surface = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [r, g, b] = surface.match(/\d+/g)!.map(Number);
  // A dark ground, not merely a different one.
  expect((r + g + b) / 3).toBeLessThan(70);
});

test('following the device is the default', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
