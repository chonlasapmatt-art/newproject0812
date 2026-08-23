'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartLine } from '../lib/cart';

type CartState = {
  lines: CartLine[];
  isOpen: boolean;
  coupon: string;
  open: () => void;
  close: () => void;
  add: (line: Omit<CartLine, 'id'>) => void;
  updateQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  setCoupon: (coupon: string) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,
      coupon: '',
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      // Does not open the drawer: FlyToCart already shows the dish landing in
      // the cart, and a toast (lib/toast.ts, wired in lib/add-to-cart.ts)
      // confirms it. Forcing the drawer open on every tap used to interrupt
      // browsing with a full panel for something two lighter-weight signals
      // already say.
      add: (line) => set((state) => {
        const signature = JSON.stringify([line.sku, line.options ?? [], line.addOns ?? [], line.note ?? '']);
        const existing = state.lines.find((item) => item.id === signature);
        const lines = existing
          ? state.lines.map((item) => item.id === signature ? { ...item, quantity: item.quantity + line.quantity } : item)
          : [...state.lines, { ...line, id: signature }];
        return { lines };
      }),
      updateQuantity: (id, quantity) => set((state) => ({
        lines: quantity <= 0 ? state.lines.filter((item) => item.id !== id) : state.lines.map((item) => item.id === id ? { ...item, quantity } : item),
      })),
      remove: (id) => set((state) => ({ lines: state.lines.filter((item) => item.id !== id) })),
      setCoupon: (coupon) => set({ coupon }),
      clear: () => set({ lines: [], coupon: '', isOpen: false }),
    }),
    { name: 'imjai-cart-v2', partialize: (state) => ({ lines: state.lines, coupon: state.coupon }) },
  ),
);
