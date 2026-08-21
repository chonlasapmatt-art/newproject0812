import { expect, signIn, test } from './fixtures';

/**
 * The paths that must never break: a customer getting a dish into their
 * basket, a guest being asked for an account without losing that dish, and a
 * stranger being kept out of the shop's own data.
 */

test('a signed-in customer can browse the menu and add a dish', async ({ page }) => {
  await signIn(page);
  await page.goto('/menu');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: /เลือกความอร่อย/ })).toBeVisible();
  await page.getByRole('button', { name: /เลือกตัวเลือก/ }).first().click();
  await page.getByRole('button', { name: /เพิ่มลงตะกร้า/ }).click();

  await expect(page.getByLabel(/ตะกร้าสินค้า/)).toBeVisible();
});

test('a guest who taps add is sent to sign in and keeps the dish', async ({ page }) => {
  await page.goto('/menu');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /เลือกตัวเลือก/ }).first().click();
  await page.getByRole('button', { name: /เพิ่มลงตะกร้า/ }).click();

  // Taken to sign in, told where to go back to, and the dish is held for them.
  // The trailing slash is optional: the static export adds one, the server
  // build does not, and either is the same destination.
  await expect(page).toHaveURL(/\/account\/?\?next=/);
  const held = await page.evaluate(() => sessionStorage.getItem('imjai-pending-add'));
  expect(held).toBeTruthy();
  expect(JSON.parse(held!).line.sku).toBeTruthy();

  // Nothing was added behind their back.
  const cart = await page.evaluate(() => localStorage.getItem('imjai-cart-v2'));
  expect(cart ? JSON.parse(cart).state.lines.length : 0).toBe(0);
});

test('an anonymous visitor cannot view admin data', async ({ page }) => {
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'สำหรับทีมงานอิ่มใจ' })).toBeVisible();
  await expect(page.getByText('รายได้วันนี้')).toHaveCount(0);
});
