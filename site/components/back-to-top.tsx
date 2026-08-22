'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DURATION, EASE, paced, useMotionOK } from '../lib/motion';

/**
 * The way back up from a long page.
 *
 * The menu runs to sixteen dishes and the dashboard's order list is longer
 * still, so by the time someone has read to the bottom the header is a long
 * way off. It appears only once there is a real distance to travel — showing
 * it near the top would be a button that does nothing.
 *
 * The scroll handler is throttled through a frame rather than run on every
 * event, since the only thing it decides is one boolean.
 */

const APPEARS_AFTER = 700;

export function BackToTop() {
  const motionOK = useMotionOK();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let raf = 0;
    const sync = () => {
      raf = 0;
      setShow(window.scrollY > APPEARS_AFTER);
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

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          className="back-to-top"
          aria-label="กลับขึ้นด้านบน"
          onClick={() => window.scrollTo({ top: 0, behavior: motionOK ? 'smooth' : 'auto' })}
          initial={{ opacity: 0, y: 14, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.8 }}
          transition={{ duration: paced(DURATION.base, motionOK), ease: EASE.enter }}
        >
          <ArrowUp size={19} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
