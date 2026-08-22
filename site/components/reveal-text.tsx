'use client';

import { motion } from 'motion/react';
import type { ElementType, ReactNode } from 'react';
import { DURATION, EASE, paced, useMotionOK } from '../lib/motion';

/**
 * Headlines that rise into place one line at a time.
 *
 * Each line sits in a box with its overflow hidden, and the text starts fully
 * below that box. Sliding it up reads as a curtain lifting rather than a fade,
 * which is what makes a headline feel set rather than dropped in.
 *
 * The masking is where Thai needs care. A Latin line box can be cropped tight
 * to the cap height, but Thai stacks marks in both directions — ไม้โท above
 * the letter, สระอุ below it — and a hero set at line-height .94 would have
 * the mask slice them off. So the box is padded top and bottom and the padding
 * is pulled back out with a matching negative margin: the mask gains room, the
 * layout does not move.
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
            initial={{ y: '112%' }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, margin: '0px 0px -40px 0px' }}
            transition={{
              duration: paced(DURATION.slow, motionOK),
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
