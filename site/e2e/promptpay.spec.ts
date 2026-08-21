import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Covers the PromptPay path end to end: the QR has to appear with the exact
 * amount for this order, and the order must stay unsubmittable until a slip is
 * attached.
 */

/** Fill a basket past the store's ฿100 minimum. */
async function addToCart(page: Page, quantity = 3) {
  await page.goto('/menu');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /เลือกตัวเลือก/ }).first().click();
  await expect(page.locator('.product-modal')).toBeVisible();
  for (let i = 1; i < quantity; i += 1) await page.getByLabel('เพิ่มจำนวน').click();
  await page.getByRole('button', { name: /เพิ่มลงตะกร้า/ }).click();
}

async function openPromptPay(page: Page) {
  await page.goto('/checkout');
  await page.waitForLoadState('networkidle');
  await page.locator('input[value="promptpay"]').check();
  await expect(page.locator('.ppay-card')).toBeVisible();
}

test('choosing PromptPay renders a QR for this order', async ({ page }) => {
  await addToCart(page);
  await openPromptPay(page);

  await expect(page.locator('.ppay-qr svg')).toBeVisible();
  await expect(page.locator('.ppay-scheme')).toContainText('THAI QR');
  await expect(page.locator('.ppay-account')).toContainText('ชื่อบัญชี');
});

test('the QR asks for the order total plus its satang marker', async ({ page }) => {
  await addToCart(page);
  await openPromptPay(page);

  const summary = await page.locator('.summary-total dd').innerText();
  const charged = await page.locator('.ppay-amount b').innerText();

  const baht = Number(summary.replace(/[^\d.]/g, ''));
  const payable = Number(charged.replace(/[^\d.]/g, ''));

  // Same baht, plus a suffix under one baht that identifies this order.
  expect(Math.floor(payable)).toBe(baht);
  expect(payable).toBeGreaterThan(baht);
  expect(payable - baht).toBeLessThan(1);
});

test('a PromptPay order cannot be submitted without a slip', async ({ page }) => {
  await addToCart(page);
  await openPromptPay(page);

  await expect(page.locator('.place-order')).toBeDisabled();
  await expect(page.getByText(/กรุณาอัปโหลดสลิป/)).toBeVisible();
});

test('paying cash needs no slip and stays submittable', async ({ page }) => {
  await addToCart(page);
  await page.goto('/checkout');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('.ppay-card')).toHaveCount(0);
  await expect(page.locator('.place-order')).toBeEnabled();
});
