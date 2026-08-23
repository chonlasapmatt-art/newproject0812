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
 *
 * The shape of the entrance changes with where it's going, on the same
 * duration and easing everywhere: the menu rises like something set down in
 * front of you, checkout advances from the right like the next step in a
 * queue, tracking drops in from above like a status arriving, account slides
 * in from the side like a personal drawer, and the back office — a working
 * screen, not a page of the shop — just fades, plainly. Same hand, different
 * gestures, so returning to a page after a while does not feel identical to
 * arriving anywhere else on the site.
 */

type Reach = { opacity: number; x?: number; y?: number; scale?: number };

function variantFor(pathname: string): { initial: Reach; exit: Reach } {
  const [, top] = pathname.split('/');
  switch (top) {
    case '':
      return { initial: { opacity: 0, scale: 0.975, y: 10 }, exit: { opacity: 0, scale: 1.015 } };
    case 'menu':
      return { initial: { opacity: 0, y: 34 }, exit: { opacity: 0, y: -18 } };
    case 'checkout':
      return { initial: { opacity: 0, x: 34 }, exit: { opacity: 0, x: -20 } };
    case 'track':
      return { initial: { opacity: 0, y: -26 }, exit: { opacity: 0, y: 14 } };
    case 'account':
      return { initial: { opacity: 0, x: -34 }, exit: { opacity: 0, x: 20 } };
    case 'admin':
      return { initial: { opacity: 0 }, exit: { opacity: 0 } };
    default:
      return { initial: { opacity: 0, y: 16 }, exit: { opacity: 0, y: -8 } };
  }
}

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const motionOK = useMotionOK();

  const enter = motionOK ? DURATION.base : 0.01;
  const leave = motionOK ? DURATION.tap : 0.01;
  const variant = variantFor(pathname);

  return (
    <>
      {/* initial={false} keeps the very first page from animating in: arriving
          at a URL is not a transition, and the opening sequence covers it. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          className="route-stage"
          initial={variant.initial}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1, transition: { duration: enter, ease: EASE.enter } }}
          exit={{ ...variant.exit, transition: { duration: leave, ease: EASE.exit } }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      <span key={pathname} className="route-sweep" aria-hidden />
    </>
  );
}
