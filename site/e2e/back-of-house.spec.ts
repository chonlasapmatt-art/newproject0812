import { ADMIN_EMAIL, anOrder, expect, seedOrders, signIn, test } from './fixtures';

/**
 * The shop running itself.
 *
 * Each case checks that an action taken behind the counter reaches the front:
 * a status the kitchen sets appears on the customer's timeline, a payment
 * staff confirm changes what the customer is told, and a dish marked sold out
 * disappears from the menu. If these pass, the dashboard is a control panel
 * rather than a picture of one.
 */

test('the dashboard counts real orders rather than sample ones', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL);
  await seedOrders(page, [anOrder(), anOrder({ orderNumber: 'IJ260821-TES2', idempotencyKey: 'e2e-2', status: 'preparing' })]);

  await page.goto('/admin');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'ภาพรวม' })).toBeVisible();
  await expect(page.getByText('2 ออเดอร์ในระบบ')).toBeVisible();
  // Two orders at ฿158 each, both placed today.
  await expect(page.locator('.metric-grid h2').first()).toHaveText('฿316');
});

test('a status the kitchen sets reaches the customer timeline', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL);
  await seedOrders(page, [anOrder()]);

  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /ออเดอร์$/ }).click();

  await page.locator('.order-card select').first().selectOption('preparing');
  await expect(page.locator('.order-card select').first()).toHaveValue('preparing');

  await page.goto('/track?order=IJ260821-TEST');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.timeline li.done')).toHaveCount(3);
  await expect(page.locator('.timeline em')).toHaveText('สถานะปัจจุบัน');
});

test('confirming a slip changes what the customer is told', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL);
  await seedOrders(page, [anOrder()]);

  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /ออเดอร์$/ }).click();
  await page.getByRole('button', { name: /ยืนยันยอด/ }).click();

  await page.goto('/track?order=IJ260821-TEST');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.payment-state.ok')).toContainText('ชำระเงินแล้ว');
});

test('a dish marked sold out leaves the menu', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL);
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /เมนูและสต็อก/ }).click();

  const row = page.locator('.menu-editor', { hasText: 'ข้าวผัดกะเพราหมูสับ' });
  await row.getByRole('button', { name: 'เปิดขาย' }).click();
  await expect(row.getByRole('button', { name: 'ปิดขาย' })).toBeVisible();

  await page.goto('/menu');
  await page.waitForLoadState('networkidle');
  const card = page.locator('.catalog-card', { hasText: 'ข้าวผัดกะเพราหมูสับ' });
  await expect(card).toHaveClass(/sold-out/);
  await expect(card.getByRole('button', { name: 'สินค้าหมด' })).toBeDisabled();
});

test('a price the shop changes is the price the customer pays', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL);
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /เมนูและสต็อก/ }).click();

  const row = page.locator('.menu-editor', { hasText: 'ข้าวไข่เจียวหมูสับ' });
  const price = row.locator('input[type="number"]').first();
  await price.fill('72');
  await price.press('Enter');

  await page.goto('/menu');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.catalog-card', { hasText: 'ข้าวไข่เจียวหมูสับ' })).toContainText('฿72');
});
