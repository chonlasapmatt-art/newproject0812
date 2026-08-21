'use client';

import { useEffect } from 'react';

/**
 * Press feedback for every button on the site, from one listener.
 *
 * A bloom of warmth spreads from wherever the finger actually landed, which is
 * what separates a real press from a canned hover state. Doing it here rather
 * than in each component means a button added later gets the behaviour for
 * free, and no component has to carry animation plumbing it does not own.
 *
 * The listener only records where the press happened; CSS does the drawing,
 * so nothing animates on the main thread and reduced-motion is handled by the
 * stylesheet along with everything else.
 */

/** Buttons that get the treatment. Icon-only controls stay quiet on purpose. */
const SELECTOR = [
  '.primary-button',
  '.nav-order',
  '.quick-add',
  '.add-cart-button',
  '.checkout-button',
  '.place-order',
  '.cart-button',
  '.section-link',
].join(',');

export function TactileLayer() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest?.(SELECTOR);
      if (!(target instanceof HTMLElement)) return;

      const box = target.getBoundingClientRect();
      target.style.setProperty('--press-x', `${event.clientX - box.left}px`);
      target.style.setProperty('--press-y', `${event.clientY - box.top}px`);

      // Restarting the animation needs the class gone for a frame.
      target.classList.remove('is-pressed');
      void target.offsetWidth;
      target.classList.add('is-pressed');
    };

    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.animationName !== 'press-bloom') return;
      (event.target as HTMLElement | null)?.classList.remove('is-pressed');
    };

    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('animationend', onAnimationEnd, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('animationend', onAnimationEnd, true);
    };
  }, []);

  return null;
}
