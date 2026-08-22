import { DASHBOARD_KEY, expect, signIn, test, unlockDashboard } from './fixtures';

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

  // Held at the door, and told to sign in rather than shown a way past it.
  await expect(page.getByText('รายได้วันนี้')).toHaveCount(0);
  await expect(page.locator('.admin-page')).toHaveCount(0);
  // Scoped to the lock screen: the header carries a sign-in link on every page.
  await expect(page.locator('.admin-lock').getByRole('link', { name: /เข้าสู่ระบบ/ })).toBeVisible();
});

/**
 * While no database is connected the dashboard shows the viewer their own
 * browser's orders and nobody else's, so the shop can let itself in. The point
 * of this case is the wording: the old screen told the owner to contact their
 * administrator, which is the owner.
 */
test('the shop opens its own dashboard with the key, and nobody else can', async ({ page }) => {
  await signIn(page, 'owner@imjai.test');
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');

  // A wrong key is refused and says so, rather than silently doing nothing.
  await page.getByLabel('รหัสเปิดแดชบอร์ด').fill('let-me-in');
  await page.getByRole('button', { name: 'เปิดแดชบอร์ด' }).click();
  await expect(page.getByText('รหัสไม่ถูกต้อง')).toBeVisible();
  await expect(page.getByText('รายได้วันนี้')).toHaveCount(0);

  await page.getByLabel('รหัสเปิดแดชบอร์ด').fill(DASHBOARD_KEY);
  await page.getByRole('button', { name: 'เปิดแดชบอร์ด' }).click();

  await expect(page.getByRole('heading', { name: 'ภาพรวม' })).toBeVisible();
  await expect(page.getByText('รายได้วันนี้')).toBeVisible();
});

/**
 * Somebody handed the site link. They can sign in and shop like anyone else,
 * and the shop's back office is not part of what they were given.
 */
test('a visitor with the link sees no way into the back office', async ({ page }) => {
  await signIn(page, 'someone@example.com');
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.locator('.account-chip').click();
  await expect(page.getByRole('menuitem', { name: /แดชบอร์ด/ })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: /ดูแบบแอดมิน/ })).toHaveCount(0);

  // And typing the address in reaches a locked door, not the dashboard.
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('รหัสเปิดแดชบอร์ด')).toBeVisible();
  await expect(page.getByText('รายได้วันนี้')).toHaveCount(0);
});

/**
 * The shop has to walk both sides of its own site — order as a customer, then
 * read the order off the dashboard — so switching between the two is one tap
 * rather than a sign-out and a second address.
 */
test('the account menu switches between the customer and shop views', async ({ page }) => {
  await signIn(page, 'owner@imjai.test');
  await unlockDashboard(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const openMenu = () => page.locator('.account-chip').click();

  await openMenu();
  await expect(page.getByRole('link', { name: /แดชบอร์ดร้าน/ })).toHaveCount(0);
  await page.getByRole('menuitem', { name: /ดูแบบแอดมินร้าน/ }).click();

  await openMenu();
  await expect(page.getByRole('menuitem', { name: /แดชบอร์ดร้าน/ })).toBeVisible();
  await page.getByRole('menuitem', { name: /ดูแบบลูกค้าทั่วไป/ }).click();

  await openMenu();
  await expect(page.getByRole('menuitem', { name: /แดชบอร์ดร้าน/ })).toHaveCount(0);
});
