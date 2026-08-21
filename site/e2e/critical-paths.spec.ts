import { expect, test } from '@playwright/test';

test('guest can browse menu and add an item', async ({ page }) => {
  await page.goto('/menu');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /เลือกความอร่อย/ })).toBeVisible();
  await page.getByRole('button', { name: /เลือกตัวเลือก/ }).first().click();
  await page.getByRole('button', { name: /เพิ่มลงตะกร้า/ }).click();
  await expect(page.getByLabel(/ตะกร้าสินค้า/)).toBeVisible();
});

test('anonymous visitor cannot view admin data', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'สำหรับทีมงานอิ่มใจ' })).toBeVisible();
  await expect(page.getByText('รายได้วันนี้')).toHaveCount(0);
});
