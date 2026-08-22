'use client';

import { motion, useMotionValue, useSpring } from 'motion/react';
import type { PointerEvent, ReactNode } from 'react';
import { useMotionOK } from '../lib/motion';

/**
 * A control that leans toward the pointer.
 *
 * The shift is small — a fifth of the distance from the centre — and springs
 * back on leave. At that size it does not move the target out from under the
 * cursor; it just makes the button feel like it noticed.
 *
 * Only mouse pointers get it. On a touch screen there is no hover to lean
 * into, and a finger already covers the control; reacting to `pointermove`
 * there would shift the button under the thumb mid-tap.
 */

type Props = {
  children: ReactNode;
  className?: string;
  /** Fraction of the distance from centre to travel. */
  strength?: number;
};

export function Magnetic({ children, className, strength = 0.2 }: Props) {
  const motionOK = useMotionOK();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 280, damping: 22, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 280, damping: 22, mass: 0.4 });

  const follow = (event: PointerEvent<HTMLSpanElement>) => {
    if (!motionOK || event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - box.left - box.width / 2) * strength);
    y.set((event.clientY - box.top - box.height / 2) * strength);
  };

  const release = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span
      className={className}
      style={{ x: springX, y: springY, display: 'inline-flex' }}
      onPointerMove={follow}
      onPointerLeave={release}
      // A press can end outside the element, and a button left off-centre
      // after the click looks broken.
      onPointerCancel={release}
    >
      {children}
    </motion.span>
  );
}
