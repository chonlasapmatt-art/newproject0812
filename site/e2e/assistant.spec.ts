import { anOrder, expect, seedOrders, signIn, test } from './fixtures';

/**
 * น้องอิ่มใจ answering from the shop's own data.
 *
 * The point of these is that the assistant is grounded: the price it quotes is
 * the one on the menu, the order it reads out belongs to the person asking,
 * and a guest gets sent to sign in rather than shown anybody's order.
 */

async function openChat(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'เปิดแชทกับน้องอิ่มใจ' }).click();
  await expect(page.locator('.assistant-panel')).toBeVisible();
}

async function ask(page: import('@playwright/test').Page, question: string) {
  await page.getByLabel('พิมพ์คำถาม').fill(question);
  await page.getByRole('button', { name: 'ส่งข้อความ' }).click();
}

test('it quotes the price that is actually on the menu', async ({ page }) => {
  await page.goto('/');
  await openChat(page);
  await ask(page, 'ลาเต้ราคาเท่าไหร่');

  await expect(page.locator('.chat-bubble.bot').last()).toContainText('฿70');
  await expect(page.locator('.chat-dish').first()).toBeVisible();
});

test('it builds something that fits a stated budget', async ({ page }) => {
  await page.goto('/');
  await openChat(page);
  await ask(page, 'งบ 150 กินอะไรดี');

  const dishes = page.locator('.chat-dish');
  await expect(dishes.first()).toBeVisible();
  const prices = await dishes.locator('small').allInnerTexts();
  const total = prices.reduce((sum, text) => sum + Number(text.replace(/[^\d]/g, '').slice(0, 3)), 0);
  expect(total).toBeLessThanOrEqual(150);
});

test('it sends a guest to sign in instead of reading out an order', async ({ page }) => {
  await seedOrders(page, [anOrder()]);
  await page.goto('/');
  await openChat(page);
  await ask(page, 'ออเดอร์ฉันถึงไหนแล้ว');

  const reply = page.locator('.chat-bubble.bot').last();
  await expect(reply).toContainText('เข้าสู่ระบบ');
  await expect(reply).not.toContainText('IJ260821-TEST');
});

test('it reads back the signed-in customer own order', async ({ page }) => {
  await signIn(page);
  await seedOrders(page, [anOrder({ status: 'preparing' })]);
  await page.goto('/');
  await openChat(page);
  await ask(page, 'ออเดอร์ถึงไหนแล้ว');

  await expect(page.locator('.chat-bubble.bot').last()).toContainText('IJ260821-TEST');
  await expect(page.locator('.chat-bubble.bot').last()).toContainText('กำลังปรุง');
});

test('adding from the chat sends a guest to sign in with the dish held', async ({ page }) => {
  await page.goto('/');
  await openChat(page);
  await ask(page, 'แนะนำของหวานหน่อย');

  await page.locator('.chat-dish-add').first().click();
  await expect(page).toHaveURL(/\/account\/?\?next=/);
  const held = await page.evaluate(() => sessionStorage.getItem('imjai-pending-add'));
  expect(JSON.parse(held!).line.sku).toContain('DS-');
});
