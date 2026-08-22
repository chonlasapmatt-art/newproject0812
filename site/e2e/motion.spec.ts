import { expect, signIn, test } from './fixtures';

/**
 * The added motion, checked for the things that would actually cost a
 * customer something: a figure on screen that no longer matches the shop's
 * settings, a payment amount that copies wrong, and animation that ignores a
 * visitor who asked for less of it.
 *
 * The movement itself is not asserted. Whether a headline slides is a matter
 * of taste and will be tuned; whether the strip quotes the real delivery
 * threshold is not.
 */

test('the facts strip quotes the shop settings, not written-in numbers', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const strip = page.getByLabel('ข้อมูลร้านโดยย่อ');
  await expect(strip).toContainText('฿300');
  await expect(strip).toContainText('฿100');
  await expect(strip).toContainText('07:00 – 20:00');
});

test('the way back up appears only once there is a way back', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const button = page.getByRole('button', { name: 'กลับขึ้นด้านบน' });
  await expect(button).toHaveCount(0);

  await page.evaluate(() => window.scrollTo(0, 1600));
  await expect(button).toBeVisible();

  await button.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(40);
});

test.describe('copying the payment figure', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('copies the satang suffix that identifies the order', async ({ page }) => {
    await signIn(page);
    await page.goto('/menu');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /เลือกตัวเลือก/ }).first().click();
    await page.getByLabel('เพิ่มจำนวน').click();
    await page.getByRole('button', { name: /เพิ่มลงตะกร้า/ }).click();

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');
    await page.locator('input[value="promptpay"]').check();
    await expect(page.locator('.ppay-card')).toBeVisible();

    const shown = (await page.locator('.ppay-amount b').innerText()).replace('฿', '');
    await page.getByRole('button', { name: /คัดลอกยอด/ }).click();
    await expect(page.getByRole('button', { name: /คัดลอกแล้ว/ })).toBeVisible();

    // What lands on the clipboard must be the exact figure, with the satang
    // and without the currency mark a banking app cannot accept.
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(shown);
    expect(copied).toMatch(/^\d+\.\d{2}$/);
    expect(copied.endsWith('.00')).toBe(false);
  });
});

test.describe('a visitor who asked for less motion', () => {
  test('gets the facts standing still and the headline in place', async ({ page }) => {
    // Set on the page rather than through test.use: the context option did not
    // reach matchMedia here, and a preference the app never sees would make
    // this pass for the wrong reason.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The strip is a readable row rather than a stalled animation.
    await expect(page.locator('.marquee-track')).not.toHaveClass(/is-running/);

    // And the headline is legible, not parked below its own mask.
    const headline = page.locator('.hero-copy .reveal-line > span').first();
    await expect(headline).toBeVisible();
    const offset = await headline.evaluate((node) => {
      const line = node.parentElement!.getBoundingClientRect();
      return Math.abs(node.getBoundingClientRect().top - line.top);
    });
    expect(offset).toBeLessThan(30);
  });
});
