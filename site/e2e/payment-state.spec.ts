import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * The tracking page is where a customer learns whether their transfer went
 * through, so each payment state has to read unambiguously — and a state must
 * never claim the money arrived unless the bank said so.
 */

const ORDER = 'IJ260821-TEST';

async function seedOrder(page: Page, paymentStatus: string, paymentNote: string | null = null) {
  await page.goto('/track');
  await page.evaluate(
    ([status, note, order]) => {
      localStorage.setItem(
        'imjai-orders',
        JSON.stringify([
          {
            orderNumber: order,
            phone: '0812345678',
            status: 'pending',
            createdAt: new Date().toISOString(),
            paymentStatus: status,
            paymentNote: note,
            payableAmount: 237.04,
            totals: { total: 237 },
            fulfilment: 'pickup',
            lines: [{ name: 'ข้าวผัดกะเพราหมูสับ', quantity: 3 }],
          },
        ]),
      );
    },
    [paymentStatus, paymentNote, ORDER] as const,
  );
  await page.goto(`/track?order=${ORDER}&created=1`);
  await expect(page.locator('.payment-state')).toBeVisible();
}

test('a confirmed transfer says so, and shows the exact amount settled', async ({ page }) => {
  await seedOrder(page, 'paid', 'ยืนยันยอดกับธนาคารเรียบร้อย');

  const panel = page.locator('.payment-state');
  await expect(panel).toHaveClass(/\bok\b/);
  await expect(panel).toContainText('ชำระเงินแล้ว');
  await expect(panel).toContainText('฿237.04');
});

test('an unverified transfer never reads as paid', async ({ page }) => {
  await seedOrder(page, 'pending_verification');

  const panel = page.locator('.payment-state');
  await expect(panel).toHaveClass(/\bwait\b/);
  await expect(panel).toContainText('รอตรวจสอบสลิป');
  await expect(panel).not.toContainText('ชำระเงินแล้ว');
});

test('a rejected slip explains why in the verifier\'s own words', async ({ page }) => {
  const reason = 'ยอดโอน ฿237.00 ไม่ตรงกับยอดที่ต้องชำระ ฿237.04';
  await seedOrder(page, 'rejected', reason);

  const panel = page.locator('.payment-state');
  await expect(panel).toHaveClass(/\bstop\b/);
  await expect(panel).toContainText('สลิปไม่ผ่านการตรวจ');
  await expect(panel).toContainText(reason);
});

test('a cash order is not quoted the QR satang suffix', async ({ page }) => {
  await seedOrder(page, 'unpaid');

  const panel = page.locator('.payment-state');
  await expect(panel).toContainText('ชำระตอนรับอาหาร');
  // 237.04 belongs to the PromptPay QR; cash at the counter owes ฿237.
  await expect(panel).not.toContainText('237.04');
});
