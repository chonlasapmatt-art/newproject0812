import { STORE } from './catalog';

export type CartLine = {
  id: string;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
  options?: string[];
  addOns?: { name: string; price: number }[];
  note?: string;
  emoji: string;
};

export const lineTotal = (line: CartLine) =>
  (line.unitPrice + (line.addOns ?? []).reduce((sum, addOn) => sum + addOn.price, 0)) * line.quantity;

export const cartSubtotal = (lines: CartLine[]) => lines.reduce((sum, line) => sum + lineTotal(line), 0);

export const cartTotals = (lines: CartLine[], delivery: boolean, coupon = '') => {
  const subtotal = cartSubtotal(lines);
  const discount = coupon.trim().toUpperCase() === 'IMJAI15' && subtotal >= 200 ? 15 : 0;
  const deliveryFee = delivery && subtotal < STORE.freeDeliveryAt ? STORE.deliveryFee : 0;
  return { subtotal, discount, deliveryFee, total: Math.max(0, subtotal - discount + deliveryFee) };
};
