import { ADMIN_EMAIL, anOrder, expect, seedOrders, signIn, test, unlockDashboard } from './fixtures';

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
  await unlockDashboard(page);
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
  await unlockDashboard(page);
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
  await unlockDashboard(page);
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
  await unlockDashboard(page);
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
  await unlockDashboard(page);
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

/**
 * The sales screen is what the shop will reconcile against its till, so this
 * checks the arithmetic reaches the page — not that a chart rendered.
 */
test('the sales screen totals the real orders and ranks the real dishes', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL);
  await unlockDashboard(page);
  await seedOrders(page, [
    anOrder({ status: 'completed' }),
    anOrder({
      orderNumber: 'IJ260821-CAKE',
      idempotencyKey: 'e2e-cake',
      status: 'completed',
      lines: [{ id: 'c', sku: 'DS-01', name: 'เค้กช็อกโกแลต', unitPrice: 89, quantity: 5, emoji: '🍰' }],
      totals: { subtotal: 445, discount: 0, deliveryFee: 0, total: 445 },
    }),
    // Cancelled: placed, refused, and therefore never earned.
    anOrder({
      orderNumber: 'IJ260821-VOID',
      idempotencyKey: 'e2e-void',
      status: 'cancelled',
      totals: { subtotal: 900, discount: 0, deliveryFee: 0, total: 900 },
    }),
  ]);

  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /^ยอดขาย$/ }).click();

  // 158 + 445, with the cancelled 900 left out.
  await expect(page.locator('.metric-grid h2').first()).toHaveText('฿603');
  await expect(page.locator('.metric-grid h2').nth(1)).toHaveText('฿302');

  // The cake outsold the rice, so it leads.
  await expect(page.locator('.sales-ranking li').first()).toContainText('เค้กช็อกโกแลต');
  await expect(page.locator('.sales-ranking li').first()).toContainText('฿445');
  await expect(page.locator('.sales-ranking li').first()).toContainText('5 ที่');

  // Today is bucketed by hour; a week is bucketed by day.
  await expect(page.locator('.sales-bar')).toHaveCount(24);
  await page.getByRole('button', { name: /^7 วัน$/ }).click();
  await expect(page.locator('.sales-bar')).toHaveCount(7);
});
