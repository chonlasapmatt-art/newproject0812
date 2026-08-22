'use client';

import { motion } from 'motion/react';
import type { ElementType, ReactNode } from 'react';
import { DURATION, EASE, paced, useMotionOK } from '../lib/motion';

/**
 * Headlines that rise gently into place, one line at a time.
 *
 * This used to be a curtain: each line sat in a box with its overflow hidden
 * and slid up from underneath. It looked right in Latin and was wrong in Thai
 * from the first day. Thai stacks marks in both directions — ไม้โท above the
 * letter, สระอุ below — so a mask cropped to the line box slices them off, and
 * any moment the animation was not finished showed a headline cut into ribbons.
 * Padding the mask bought room but never enough, because the amount needed
 * depends on which marks the words happen to carry.
 *
 * So there is no mask any more. A line fades and lifts a few pixels, and
 * nothing anywhere clips it: at rest, mid-animation, on a slow phone, or if
 * the animation never runs at all, the words are whole. The movement is
 * smaller than the curtain was, which is the point — the text stays readable
 * the entire way in.
 */

type Props = {
  /** One entry per visual line. Markup is allowed — the hero italicises a word. */
  lines: ReactNode[];
  as?: ElementType;
  className?: string;
  /** Seconds before the first line starts. */
  delay?: number;
  /** Seconds between one line and the next. */
  stagger?: number;
};

export function RevealLines({ lines, as: Tag = 'h1', className, delay = 0, stagger = 0.08 }: Props) {
  const motionOK = useMotionOK();

  return (
    <Tag className={className}>
      {lines.map((line, index) => (
        // Lines are a fixed list written at the call site, so the index is a
        // stable identity here.
        <span className="reveal-line" key={index}>
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px 0px -40px 0px' }}
            transition={{
              duration: paced(DURATION.base, motionOK),
              ease: EASE.enter,
              delay: motionOK ? delay + index * stagger : 0,
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/**
 * A rule that draws itself out from the middle as it comes into view.
 *
 * Used between sections in place of a border, because a line that arrives with
 * the content marks a change of subject; a static one is just furniture.
 */
export function Divider() {
  const motionOK = useMotionOK();

  return (
    <motion.div
      className="section-divider"
      aria-hidden
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      transition={{ duration: paced(1.1, motionOK), ease: EASE.enter }}
    />
  );
}
