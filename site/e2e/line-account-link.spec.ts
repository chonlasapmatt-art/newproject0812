import { expect, test } from '@playwright/test';

test('an expired LINE link tells the customer how to request a new one', async ({ page }) => {
  await page.goto('/account/link-line?linkToken=short');
  await expect(page.getByRole('heading', { name: 'ลิงก์นี้ใช้ไม่ได้แล้ว' })).toBeVisible();
  await expect(page.getByText('เชื่อมบัญชี')).toBeVisible();
});

test('a valid LINE link requires the website member to sign in first', async ({ page }) => {
  await page.goto(`/account/link-line?linkToken=${'a'.repeat(40)}`);
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบก่อนเชื่อม LINE' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'เข้าสู่ระบบ / สมัครสมาชิก' })).toHaveAttribute(
    'href',
    /\/account\/?\?next=/,
  );
  await expect(page.getByText('ใช้ครั้งเดียวและหมดอายุภายใน 10 นาที')).toBeVisible();
});
