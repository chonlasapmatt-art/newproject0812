import { describe, expect, it } from 'vitest';
import { peakOf, summariseSales } from '../lib/sales';
import type { StoredOrder } from '../lib/orders';

/**
 * The dashboard's figures are what the shop will reconcile against its till,
 * so these pin the arithmetic rather than the presentation.
 */

/**
 * Times are written without a zone so they parse as local, because the code
 * buckets by local hours — which is what the shop means by "the nine o'clock
 * rush". Pinning them to +07:00 instead made the test assert Bangkok's clock
 * against whatever clock the runner happens to keep.
 */
const NOW = new Date('2026-08-22T15:00:00');
const at = (local: string) => new Date(local).toISOString();

const order = (over: Partial<StoredOrder> = {}): StoredOrder => ({
  orderNumber: 'IJ-1',
  idempotencyKey: 'k1',
  name: 'มิน',
  phone: '0899999999',
  fulfilment: 'pickup',
  payment: 'cash',
  lines: [{ id: 'l', sku: 'FD-01', name: 'กะเพรา', unitPrice: 79, quantity: 1, emoji: '🍳' }],
  totals: { subtotal: 79, discount: 0, deliveryFee: 0, total: 79 },
  payableAmount: 79,
  slipReference: null,
  paymentNote: null,
  status: 'completed',
  paymentStatus: 'paid',
  createdAt: at('2026-08-22T09:00:00'),
  ...over,
});

describe('the day summary', () => {
  it('adds up only what was not cancelled', () => {
    const sales = summariseSales(
      [
        order(),
        order({ idempotencyKey: 'k2', totals: { subtotal: 100, discount: 0, deliveryFee: 0, total: 100 } }),
        order({ idempotencyKey: 'k3', status: 'cancelled', totals: { subtotal: 500, discount: 0, deliveryFee: 0, total: 500 } }),
      ],
      'today',
      NOW,
    );
    expect(sales.revenue).toBe(179);
    expect(sales.orderCount).toBe(2);
    expect(sales.averageBasket).toBe(90);
  });

  it('leaves out anything older than the range', () => {
    const sales = summariseSales(
      [order(), order({ idempotencyKey: 'k2', createdAt: at('2026-08-10T09:00:00') })],
      'today',
      NOW,
    );
    expect(sales.orderCount).toBe(1);
  });

  it('reports no average rather than dividing by nothing', () => {
    expect(summariseSales([], 'week', NOW).averageBasket).toBe(0);
  });
});

describe('the chart buckets', () => {
  it('lays out a full day of hours so a quiet hour is a gap, not a missing column', () => {
    const sales = summariseSales([order()], 'today', NOW);
    expect(sales.buckets).toHaveLength(24);
    expect(sales.bucketUnit).toBe('hour');
    expect(sales.buckets[9].revenue).toBe(79);
    expect(sales.buckets[10].revenue).toBe(0);
  });

  it('lays out one column per day over a week, ending today', () => {
    const sales = summariseSales([order()], 'week', NOW);
    expect(sales.buckets).toHaveLength(7);
    expect(sales.bucketUnit).toBe('day');
    expect(sales.buckets[6].revenue).toBe(79);
  });

  it('names the busiest bucket, and nothing when there were no sales', () => {
    const sales = summariseSales([order(), order({ idempotencyKey: 'k2', createdAt: at('2026-08-22T12:00:00'), totals: { subtotal: 300, discount: 0, deliveryFee: 0, total: 300 } })], 'today', NOW);
    expect(peakOf(sales.buckets)?.label).toBe('12:00');
    expect(peakOf(summariseSales([], 'today', NOW).buckets)).toBeNull();
  });
});

describe('best sellers', () => {
  it('counts add-ons per unit, the way the customer was charged', () => {
    const sales = summariseSales(
      [
        order({
          lines: [{ id: 'l', sku: 'FD-01', name: 'กะเพรา', unitPrice: 79, quantity: 2, addOns: [{ name: 'ไข่ดาว', price: 15 }], emoji: '🍳' }],
        }),
      ],
      'today',
      NOW,
    );
    // (79 + 15) × 2 — two plates, two eggs.
    expect(sales.bestSellers[0].revenue).toBe(188);
    expect(sales.bestSellers[0].quantity).toBe(2);
  });

  it('merges the same dish across orders and ranks by revenue', () => {
    const sales = summariseSales(
      [
        order(),
        order({ idempotencyKey: 'k2' }),
        order({ idempotencyKey: 'k3', lines: [{ id: 'x', sku: 'DS-01', name: 'เค้ก', unitPrice: 89, quantity: 3, emoji: '🍰' }] }),
      ],
      'today',
      NOW,
    );
    expect(sales.bestSellers.map((entry) => entry.sku)).toEqual(['DS-01', 'FD-01']);
    expect(sales.bestSellers[1].quantity).toBe(2);
  });
});

describe('how the money came in', () => {
  it('splits cash from transfers, and counts what is still owed', () => {
    const sales = summariseSales(
      [
        order({ payment: 'cash', paymentStatus: 'unpaid' }),
        order({ idempotencyKey: 'k2', payment: 'promptpay', paymentStatus: 'paid', totals: { subtotal: 200, discount: 0, deliveryFee: 0, total: 200 } }),
      ],
      'today',
      NOW,
    );
    expect(sales.byPayment).toEqual({ cash: 79, promptpay: 200 });
    // The cash order has not been handed over yet.
    expect(sales.awaiting).toBe(79);
  });
});
