import { describe, expect, it } from 'vitest';
import { MENU_ITEMS } from '../lib/catalog';
import { answer, filterMenu, readConstraints, type BrainContext } from '../lib/imjai-brain';
import type { StoredOrder } from '../lib/orders';

/**
 * The assistant is only trustworthy if it answers from the shop's data. These
 * cases pin the parts a customer would notice being wrong: a price it made up,
 * a sold-out dish it offered, an allergen it ignored, or somebody else's order.
 */

const base: BrainContext = { menu: MENU_ITEMS, orders: [], signedIn: false };

const order = (over: Partial<StoredOrder> = {}): StoredOrder => ({
  orderNumber: 'IJ260821-AB12',
  idempotencyKey: 'key-1',
  name: 'มิน',
  phone: '0899999999',
  fulfilment: 'pickup',
  payment: 'promptpay',
  lines: [{ id: 'l1', sku: 'FD-01', name: 'ข้าวผัดกะเพราหมูสับ ไข่ดาว', unitPrice: 79, quantity: 2, emoji: '🍳' }],
  totals: { subtotal: 158, discount: 0, deliveryFee: 0, total: 158 },
  payableAmount: 158.42,
  slipReference: null,
  paymentNote: null,
  status: 'preparing',
  paymentStatus: 'paid',
  createdAt: new Date().toISOString(),
  accountEmail: 'min@example.com',
  ...over,
});

describe('reading the question', () => {
  it('picks the budget out of several phrasings', () => {
    expect(readConstraints('งบ 150').budget).toBe(150);
    expect(readConstraints('ไม่เกิน 80 บาท').budget).toBe(80);
    expect(readConstraints('มี 200 บาท กินอะไรดี').budget).toBe(200);
    expect(readConstraints('๑๐๐ บาท').budget).toBe(100);
  });

  it('treats an allergen as a filter only when the sentence avoids it', () => {
    expect(readConstraints('แพ้นม มีอะไรกินบ้าง').avoid).toContain('นม');
    expect(readConstraints('ลาเต้ใส่นมอะไร').avoid).toHaveLength(0);
  });

  it('reads a category and a spice preference', () => {
    expect(readConstraints('อยากได้กาแฟ').category).toBe('coffee');
    expect(readConstraints('ขอแบบไม่เผ็ด').mild).toBe(true);
  });
});

describe('filtering the menu', () => {
  it('never offers a sold-out dish', () => {
    const soldOut = MENU_ITEMS.filter((item) => !item.available).map((item) => item.sku);
    expect(soldOut.length).toBeGreaterThan(0);
    const offered = filterMenu(MENU_ITEMS, readConstraints('แนะนำเมนู')).map((item) => item.sku);
    for (const sku of soldOut) expect(offered).not.toContain(sku);
  });

  it('drops everything containing an avoided allergen', () => {
    const offered = filterMenu(MENU_ITEMS, readConstraints('แพ้นม'));
    expect(offered.length).toBeGreaterThan(0);
    for (const item of offered) expect(item.allergens).not.toContain('นม');
  });

  it('respects the budget exactly', () => {
    const offered = filterMenu(MENU_ITEMS, readConstraints('ไม่เกิน 65 บาท'));
    for (const item of offered) expect(item.price).toBeLessThanOrEqual(65);
  });
});

describe('answering', () => {
  it('quotes the real price of a dish it is asked about', () => {
    const reply = answer('ลาเต้ราคาเท่าไหร่', base);
    const latte = MENU_ITEMS.find((item) => item.sku === 'DR-C02')!;
    expect(reply.text).toContain(String(latte.price));
    expect(reply.intent).toBe('menu-search');
  });

  it('says a dish is sold out instead of taking the order', () => {
    const reply = answer('มีต้มยำกุ้งไหม', base);
    expect(reply.text).toContain('หมด');
    expect(reply.dishes?.every((item) => item.available)).toBe(true);
  });

  it('builds a meal that fits the budget', () => {
    const reply = answer('งบ 150 กินอะไรดี', base);
    expect(reply.intent).toBe('budget');
    const total = (reply.dishes ?? []).reduce((sum, item) => sum + item.price, 0);
    expect(total).toBeLessThanOrEqual(150);
    expect(reply.dishes?.length).toBeGreaterThan(0);
  });

  it('warns about cross-contamination when asked about an allergy', () => {
    const reply = answer('แพ้นม แนะนำอะไรได้บ้าง', base);
    expect(reply.text).toContain('โทรยืนยัน');
    for (const item of reply.dishes ?? []) expect(item.allergens).not.toContain('นม');
  });

  it('quotes the store hours rather than inventing them', () => {
    const reply = answer('ร้านเปิดกี่โมง', base);
    expect(reply.intent).toBe('hours');
    expect(reply.text).toContain('07:00');
  });

  it('quotes the real delivery figures', () => {
    const reply = answer('ค่าส่งเท่าไหร่', base);
    expect(reply.text).toContain('30');
    expect(reply.text).toContain('300');
  });

  it('refuses to confirm a payment itself', () => {
    const reply = answer('ยืนยันการจ่ายเงินให้หน่อย', base);
    expect(reply.intent).toBe('payment');
    expect(reply.text).toContain('ไม่สามารถยืนยันการชำระเงิน');
  });

  it('asks a guest to sign in before showing any order', () => {
    const reply = answer('ออเดอร์ฉันถึงไหนแล้ว', base);
    expect(reply.link?.href).toBe('/account');
    expect(reply.text).not.toContain('IJ');
  });

  it('reports the signed-in customer own order', () => {
    const reply = answer('ออเดอร์ถึงไหนแล้ว', { ...base, signedIn: true, orders: [order()] });
    expect(reply.text).toContain('IJ260821-AB12');
    expect(reply.text).toContain('กำลังปรุง');
  });

  it('will not open an order number that is not theirs', () => {
    const reply = answer('เช็คออเดอร์ IJ260821-ZZ99', { ...base, signedIn: true, orders: [order()] });
    expect(reply.text).toContain('ไม่ได้อยู่ในบัญชีนี้');
    expect(reply.text).not.toContain('กำลังปรุง');
  });

  it('hands over to a person when it does not know', () => {
    const reply = answer('วันนี้อากาศเป็นยังไงบ้าง', base);
    expect(reply.intent).toBe('unknown');
    expect(reply.text).toContain('LINE');
  });

  it('answers an empty message without crashing', () => {
    expect(answer('   ', base).text.length).toBeGreaterThan(0);
  });

  /**
   * Thai has no spaces, so short keywords hide inside ordinary words: "งบ"
   * sits in "ยังไงบ้าง" and "เจ" in "เจอ". Both used to reroute the question.
   */
  it('does not mistake a substring for a keyword', () => {
    expect(answer('วันนี้เป็นยังไงบ้าง', base).intent).not.toBe('budget');
    expect(answer('เจอกันที่ร้านนะ', base).intent).not.toBe('dietary');
  });

  it('still hears a real budget through the same words', () => {
    expect(answer('งบ 120 พอไหม', base).intent).toBe('budget');
    expect(answer('อาหารเจมีไหม', base).intent).toBe('dietary');
  });
});
