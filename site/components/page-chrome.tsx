'use client';

import { motion, useScroll, useSpring } from 'motion/react';
import { useEffect } from 'react';
import { useMotionOK } from '../lib/motion';

/**
 * The two details that tell you where you are on a page.
 *
 * A reading bar across the top answers "how much is left" without the visitor
 * having to guess from the scrollbar, and the header picking up a shadow the
 * moment content slides under it makes the page feel layered rather than flat.
 *
 * Both are driven from scroll rather than from React state: a listener that
 * re-rendered the whole shell on every frame would cost more than the effect
 * is worth.
 */

export function PageChrome() {
  const motionOK = useMotionOK();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 180, damping: 30, mass: 0.4 });

  // The header lifts once anything has scrolled beneath it.
  useEffect(() => {
    const header = document.querySelector('.site-header');
    if (!header) return;

    let raf = 0;
    const sync = () => {
      raf = 0;
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };

    sync();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  if (!motionOK) return null;

  return <motion.div className="read-progress" style={{ scaleX: progress }} aria-hidden />;
}
