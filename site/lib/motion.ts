'use client';

import { useSyncExternalStore } from 'react';

/**
 * One motion vocabulary for the whole site.
 *
 * Every animation here borrows from the kitchen it represents: things rise
 * like steam, settle like a plate set down, and bloom like heat off a pan.
 * Keeping the timings and curves in one place is what stops that from
 * becoming a pile of unrelated effects — a button, a page change and the
 * opening sequence should feel like the same hand made them.
 */

/** Milliseconds. Named for what the motion is doing, not how long it takes. */
export const DURATION = {
  /** Feedback that must feel instant: a press, a toggle. */
  tap: 0.12,
  /** A small element arriving or leaving. */
  quick: 0.22,
  /** The default for anything the eye follows. */
  base: 0.38,
  /** A panel, a drawer, a page. */
  slow: 0.68,
  /** The opening sequence, which is allowed to take its time. */
  cinematic: 1.5,
} as const;

/**
 * Easings as cubic-bezier control points.
 *
 * `enter` overshoots slightly at the end so arrivals feel placed rather than
 * dropped; `exit` accelerates away because nobody watches something leave.
 */
export const EASE = {
  enter: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
  move: [0.65, 0, 0.35, 1],
  /** For steam and other ambient drift — no sharp start or stop. */
  drift: [0.37, 0, 0.63, 1],
} as const;

/** A plate being set down: rises into place and settles. */
export const settle = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: DURATION.slow, ease: EASE.enter },
} as const;

/** Steam: drifts up and thins out. */
export const rise = {
  initial: { opacity: 0, y: 26 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
  transition: { duration: DURATION.base, ease: EASE.enter },
} as const;

/**
 * Whether to animate at all.
 *
 * Returns false until mounted, so the server render and the first client
 * render agree; a component that must not flash should treat the first frame
 * as "no motion" rather than waiting for this to turn true.
 */
const REDUCED = '(prefers-reduced-motion: reduce)';

function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Read straight from the media query — no state to fall out of step with it. */
function motionSnapshot(): boolean {
  return !window.matchMedia(REDUCED).matches;
}

export function useMotionOK(): boolean {
  // The server has no media query to consult, so it renders the calm version
  // and the client corrects on hydration.
  return useSyncExternalStore(subscribeMotion, motionSnapshot, () => false);
}

/**
 * Scale a duration by how much motion the visitor wants.
 *
 * Reduced motion does not mean no feedback — it means the change should not
 * travel. Collapsing to a few milliseconds keeps state changes legible
 * without animating across the screen.
 */
export function paced(seconds: number, motionOK: boolean): number {
  return motionOK ? seconds : 0.01;
}
