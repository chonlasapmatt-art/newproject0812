'use client';

import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import { useMotionOK } from '../lib/motion';

/**
 * Depth that responds to the pointer.
 *
 * A card sitting flat on the page is a rectangle. The same card tilting a few
 * degrees toward the cursor, with a highlight sliding across it, reads as an
 * object on a surface — which is what a dish on a plate should feel like.
 *
 * The effect is deliberately small. Past about eight degrees the text starts to
 * skew and the card stops looking like a card, so the rotation is capped well
 * before that and the spring is soft enough that nothing snaps.
 */

type Props = {
  children: ReactNode;
  className?: string;
  /** Maximum tilt in degrees at the far corners. */
  strength?: number;
  /** How far the card lifts toward the viewer while hovered, in px. */
  lift?: number;
  /** A light that follows the pointer. Off for dense or text-heavy cards. */
  sheen?: boolean;
};

export function Tilt({ children, className, strength = 6, lift = 10, sheen = true }: Props) {
  const motionOK = useMotionOK();
  const ref = useRef<HTMLDivElement | null>(null);

  // -0.5 … 0.5, measured from the middle of the card.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const hovered = useMotionValue(0);

  const spring = { stiffness: 260, damping: 24, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [strength, -strength]), spring);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-strength, strength]), spring);
  const z = useSpring(useTransform(hovered, [0, 1], [0, lift]), spring);

  // The highlight tracks the pointer across the face of the card.
  const sheenX = useTransform(px, (value) => `${(value + 0.5) * 100}%`);
  const sheenY = useTransform(py, (value) => `${(value + 0.5) * 100}%`);
  const sheenOpacity = useSpring(useTransform(hovered, [0, 1], [0, 0.5]), spring);
  const sheenBackground = useMotionTemplate`radial-gradient(circle at ${sheenX} ${sheenY}, rgba(255,244,228,.9), transparent 62%)`;

  if (!motionOK) return <div className={className}>{children}</div>;

  const track = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    px.set((event.clientX - box.left) / box.width - 0.5);
    py.set((event.clientY - box.top) / box.height - 0.5);
  };

  const rest = () => {
    hovered.set(0);
    px.set(0);
    py.set(0);
  };

  return (
    <div ref={ref} className={`tilt-scene ${className ?? ''}`}>
      <motion.div
        className="tilt-body"
        style={{ rotateX, rotateY, z }}
        onPointerMove={track}
        onPointerEnter={() => hovered.set(1)}
        onPointerLeave={rest}
        // A tap should not leave a phone stuck at whatever angle it last saw.
        onPointerCancel={rest}
      >
        {children}
        {sheen && <motion.span className="tilt-sheen" aria-hidden style={{ background: sheenBackground, opacity: sheenOpacity }} />}
      </motion.div>
    </div>
  );
}
