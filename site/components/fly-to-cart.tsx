'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EASE, useMotionOK } from '../lib/motion';
import type { CartLine } from '../lib/cart';
import { useCartStore } from '../stores/cart-store';

/**
 * The dish flies to the cart when it is added.
 *
 * Without it the count in the header just changes and the connection between
 * the button and the cart is left for the customer to infer. The arc says
 * "this went there" in the one moment they are looking.
 *
 * The flight is read from the DOM at press time rather than passed down through
 * props, so any button that adds to the cart — on the home page, in the menu
 * grid, inside the dish sheet — is covered without knowing this exists.
 */

const ADD_SELECTOR = '.quick-add, .add-cart-button';

type Flight = { id: number; from: DOMRect; to: DOMRect; emoji: string };

/**
 * Which dish just landed in the cart.
 *
 * Read from the store rather than scraped out of the DOM: the button that was
 * pressed sits in a different layout on the home grid, the menu grid and inside
 * the dish sheet, and any selector that tries to cover all three ends up
 * guessing. Comparing the cart before and after is exact.
 */
function addedEmoji(before: CartLine[], after: CartLine[]): string | null {
  const previous = new Map(before.map((line) => [line.id, line.quantity]));
  for (const line of after) {
    if (line.quantity > (previous.get(line.id) ?? 0)) return line.emoji;
  }
  return null;
}

export function FlyToCart() {
  const motionOK = useMotionOK();
  const lines = useCartStore((state) => state.lines);

  const [flights, setFlights] = useState<Flight[]>([]);
  const pending = useRef<DOMRect | null>(null);
  const previousLines = useRef<CartLine[]>(lines);
  const nextId = useRef(0);

  // Remember where the press happened; the store update arrives a tick later.
  useEffect(() => {
    if (!motionOK) return;
    const onPointerDown = (event: PointerEvent) => {
      const button = (event.target as Element | null)?.closest?.(ADD_SELECTOR);
      if (!(button instanceof HTMLElement)) return;
      pending.current = button.getBoundingClientRect();
    };
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [motionOK]);

  useEffect(() => {
    const emoji = addedEmoji(previousLines.current, lines);
    previousLines.current = lines;

    const from = pending.current;
    pending.current = null;
    if (!emoji || !from || !motionOK) return;

    const cart = document.querySelector('.cart-button');
    if (!(cart instanceof HTMLElement)) return;

    const id = (nextId.current += 1);
    setFlights((current) => [...current, { id, from, to: cart.getBoundingClientRect(), emoji }]);
    window.setTimeout(() => setFlights((current) => current.filter((flight) => flight.id !== id)), 900);
  }, [lines, motionOK]);

  return (
    <AnimatePresence>
      {flights.map((flight) => {
        const from = { x: flight.from.left + flight.from.width / 2, y: flight.from.top + flight.from.height / 2 };
        const to = { x: flight.to.left + flight.to.width / 2, y: flight.to.top + flight.to.height / 2 };
        // Arc upward on the way over, the way a plate is carried.
        const lift = Math.min(from.y, to.y) - 90;

        return (
          <motion.span
            key={flight.id}
            className="cart-flight"
            aria-hidden
            initial={{ x: from.x, y: from.y, scale: 1, opacity: 1 }}
            animate={{
              x: [from.x, (from.x + to.x) / 2, to.x],
              y: [from.y, lift, to.y],
              scale: [1, 1.12, 0.4],
              opacity: [1, 1, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.72, ease: EASE.move, times: [0, 0.55, 1] }}
          >
            {flight.emoji}
          </motion.span>
        );
      })}
    </AnimatePresence>
  );
}
