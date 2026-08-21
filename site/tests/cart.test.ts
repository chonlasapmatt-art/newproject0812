import { describe, expect, it } from 'vitest';
import { cartTotals, lineTotal, type CartLine } from '../lib/cart';

const line: CartLine = { id: 'a', sku: 'FD-01', name: 'กะเพรา', unitPrice: 79, quantity: 2, addOns: [{ name: 'ไข่ดาว', price: 15 }], emoji: '🍳' };

describe('server-compatible cart calculation', () => {
  it('includes add-ons for every quantity', () => expect(lineTotal(line)).toBe(188));
  it('adds delivery below the free threshold', () => expect(cartTotals([line], true).total).toBe(218));
  it('applies IMJAI15 only when minimum spend is met', () => {
    expect(cartTotals([line], false, 'IMJAI15').discount).toBe(0);
    expect(cartTotals([{ ...line, quantity: 3 }], false, 'imjai15').discount).toBe(15);
  });
  it('never returns a negative total', () => expect(cartTotals([], false, 'IMJAI15').total).toBe(0));
});
