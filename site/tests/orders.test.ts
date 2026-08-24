import { beforeEach, describe, expect, it } from 'vitest';
import { MENU_ITEMS } from '../lib/catalog';
import { applyOverrides } from '../lib/menu-admin';
import {
  ORDERS_KEY,
  addOrder,
  cancelOrder,
  findOrder,
  flowFor,
  ordersForAccount,
  readOrders,
  setOrderStatus,
  setPaymentStatus,
  summarise,
  type StoredOrder,
} from '../lib/orders';

const at = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

const make = (over: Partial<StoredOrder> = {}): StoredOrder => ({
  orderNumber: 'IJ260821-AA01',
  idempotencyKey: 'key-1',
  name: 'มิน',
  phone: '0899999999',
  fulfilment: 'pickup',
  payment: 'cash',
  lines: [],
  totals: { subtotal: 100, discount: 0, deliveryFee: 0, total: 100 },
  payableAmount: 100,
  slipReference: null,
  paymentNote: null,
  status: 'pending',
  paymentStatus: 'unpaid',
  createdAt: at(0),
  accountEmail: 'min@example.com',
  ...over,
});

beforeEach(() => localStorage.clear());

describe('storing orders', () => {
  it('keeps a retry from becoming a second order', () => {
    addOrder(make());
    addOrder(make({ totals: { subtotal: 200, discount: 0, deliveryFee: 0, total: 200 } }));
    const stored = readOrders();
    expect(stored).toHaveLength(1);
    expect(stored[0].totals.total).toBe(200);
  });

  it('treats a different reference as a different order', () => {
    addOrder(make());
    addOrder(make({ idempotencyKey: 'key-2', orderNumber: 'IJ260821-BB02' }));
    expect(readOrders()).toHaveLength(2);
  });

  it('survives a record written by an older build', () => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify([{ orderNumber: 'IJ260101-OLD1', totals: { total: 55 } }, null, 'junk']));
    const stored = readOrders();
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe('pending');
    expect(stored[0].lines).toEqual([]);
    expect(stored[0].payableAmount).toBe(55);
  });

  it('moves an order through the kitchen', () => {
    addOrder(make());
    setOrderStatus('IJ260821-AA01', 'preparing');
    expect(findOrder('IJ260821-AA01')?.status).toBe('preparing');
  });

  it('records why a payment was rejected', () => {
    addOrder(make({ paymentStatus: 'pending_verification' }));
    setPaymentStatus('IJ260821-AA01', 'rejected', 'ยอดไม่ตรง');
    const order = findOrder('IJ260821-AA01');
    expect(order?.paymentStatus).toBe('rejected');
    expect(order?.paymentNote).toBe('ยอดไม่ตรง');
  });

  it('shows a customer only their own orders', () => {
    const orders = [make(), make({ idempotencyKey: 'k2', orderNumber: 'IJ2-B', accountEmail: 'other@example.com' })];
    expect(ordersForAccount(orders, 'MIN@example.com').map((order) => order.orderNumber)).toEqual(['IJ260821-AA01']);
    expect(ordersForAccount(orders, null)).toHaveLength(0);
  });

  it('uses the database owner id when staff can see more than one account', () => {
    const orders = [
      make({ ownerId: 'customer-a', synced: true }),
      make({ idempotencyKey: 'k2', orderNumber: 'IJ2-B', ownerId: 'customer-b', synced: true }),
    ];
    expect(ordersForAccount(orders, 'staff@imjai.test', 'customer-a').map((order) => order.orderNumber))
      .toEqual(['IJ260821-AA01']);
  });
});

describe('the tracking timeline', () => {
  it('does not promise a rider to someone collecting in person', () => {
    expect(flowFor('pickup')).not.toContain('out_for_delivery');
    expect(flowFor('delivery')).toContain('out_for_delivery');
  });
});

describe('the day summary', () => {
  it('counts today and compares against yesterday', () => {
    const orders = [
      make({ idempotencyKey: 'a', totals: { subtotal: 200, discount: 0, deliveryFee: 0, total: 200 } }),
      make({ idempotencyKey: 'b', createdAt: at(1), totals: { subtotal: 100, discount: 0, deliveryFee: 0, total: 100 } }),
    ];
    const stats = summarise(orders);
    expect(stats.revenue).toBe(200);
    expect(stats.orderCount).toBe(1);
    expect(stats.changeVsYesterday).toBe(100);
  });

  it('leaves out an order the shop cancelled', () => {
    addOrder(make());
    cancelOrder('IJ260821-AA01');
    const stats = summarise(readOrders());
    expect(stats.revenue).toBe(0);
    expect(stats.orderCount).toBe(0);
  });

  it('reports no comparison rather than a fake zero percent', () => {
    expect(summarise([make()]).changeVsYesterday).toBeNull();
  });

  it('separates paid, unpaid, pending and rejected payments for the dashboard', () => {
    const stats = summarise([
      make({ idempotencyKey: 'paid', paymentStatus: 'paid' }),
      make({ idempotencyKey: 'unpaid', paymentStatus: 'unpaid' }),
      make({ idempotencyKey: 'pending', paymentStatus: 'pending_verification' }),
      make({ idempotencyKey: 'rejected', paymentStatus: 'rejected' }),
    ]);
    expect(stats.paidCount).toBe(1);
    expect(stats.unpaidCount).toBe(1);
    expect(stats.awaitingPayment).toBe(1);
    expect(stats.rejectedPaymentCount).toBe(1);
  });
});

describe('staff edits to the menu', () => {
  it('applies a new price without touching anything else', () => {
    const [item] = applyOverrides(MENU_ITEMS, { 'DR-C02': { price: 85 } }).filter((entry) => entry.sku === 'DR-C02');
    const original = MENU_ITEMS.find((entry) => entry.sku === 'DR-C02')!;
    expect(item.price).toBe(85);
    expect(item.allergens).toEqual(original.allergens);
    expect(item.name).toBe(original.name);
  });

  it('sells out a dish the moment its stock hits zero', () => {
    const item = applyOverrides(MENU_ITEMS, { 'FD-01': { stock: 0 } }).find((entry) => entry.sku === 'FD-01')!;
    expect(item.available).toBe(false);
  });

  it('cannot mark a dish for sale when there is none left', () => {
    const item = applyOverrides(MENU_ITEMS, { 'FD-05': { available: true } }).find((entry) => entry.sku === 'FD-05')!;
    expect(item.stock).toBe(0);
    expect(item.available).toBe(false);
  });

  it('leaves untouched dishes exactly as the build shipped them', () => {
    const applied = applyOverrides(MENU_ITEMS, { 'FD-01': { price: 90 } });
    for (const item of applied) {
      if (item.sku === 'FD-01') continue;
      expect(item).toEqual(MENU_ITEMS.find((entry) => entry.sku === item.sku));
    }
  });
});
