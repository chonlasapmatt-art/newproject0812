'use client';

import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { DURATION, EASE, useMotionOK } from '../lib/motion';

/**
 * Page changes, staged like a plate being served.
 *
 * The outgoing page drops away quickly — nobody watches something leave — and a
 * warm band sweeps the seam while the new page rises and settles.
 *
 * The sweep carries no state: keying it on the pathname remounts the element on
 * every route change, which replays its CSS animation. That keeps the whole
 * transition out of React's render cycle, and lets the stylesheet's
 * reduced-motion rule switch it off with everything else.
 */

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const motionOK = useMotionOK();

  const enter = motionOK ? DURATION.base : 0.01;
  const leave = motionOK ? DURATION.tap : 0.01;

  return (
    <>
      {/* initial={false} keeps the very first page from animating in: arriving
          at a URL is not a transition, and the opening sequence covers it. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          className="route-stage"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { duration: enter, ease: EASE.enter } }}
          exit={{ opacity: 0, y: -8, transition: { duration: leave, ease: EASE.exit } }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      <span key={pathname} className="route-sweep" aria-hidden />
    </>
  );
}
