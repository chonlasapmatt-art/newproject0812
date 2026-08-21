'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { CartLine } from './cart';
import { useCan } from './session';
import { useCartStore } from '../stores/cart-store';

/**
 * Adding to the cart, with the account check in one place.
 *
 * Three different screens have an add button — the home grid, the menu grid
 * and the dish sheet — and all three must behave the same way for someone who
 * has not signed in yet. Putting the rule here means a fourth one added later
 * inherits it rather than quietly skipping the check.
 *
 * The important part is that nobody loses their tap. The dish is written down
 * before the redirect and added the moment they come back, so signing in feels
 * like a step in the order rather than an interruption that cost them work.
 */

const INTENT_KEY = 'imjai-pending-add';

type PendingAdd = { line: Omit<CartLine, 'id'>; returnTo: string };

function remember(intent: PendingAdd) {
  try {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));
  } catch {
    // Storage refused: the customer signs in and taps once more.
  }
}

/**
 * Take back whatever was pending, clearing it so a refresh cannot add the
 * same dish twice.
 */
export function claimPendingAdd(): PendingAdd | null {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    sessionStorage.removeItem(INTENT_KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw) as PendingAdd;
    return intent?.line?.sku ? intent : null;
  } catch {
    return null;
  }
}

export type AddResult = 'added' | 'needs-account';

export function useAddToCart() {
  const { canOrder } = useCan();
  const add = useCartStore((state) => state.add);
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (line: Omit<CartLine, 'id'>): AddResult => {
      if (canOrder) {
        add(line);
        return 'added';
      }

      remember({ line, returnTo: pathname });
      router.push(`/account?next=${encodeURIComponent(pathname)}`);
      return 'needs-account';
    },
    [canOrder, add, router, pathname],
  );
}
