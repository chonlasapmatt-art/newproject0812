'use client';

import { MessageCircle } from 'lucide-react';
import { isLineConfigured, lineChatUrl, lineHintFor, lineLabelFor, type LineContext } from '../lib/line-oa';

/**
 * The way out when something goes wrong.
 *
 * Placed where an order actually stalls — at the payment step, on the tracking
 * page, and on contact — rather than only in the footer. Someone whose slip was
 * rejected at nine at night should not have to go looking for how to ask.
 *
 * Renders nothing until the shop's LINE id is configured. A button that opens
 * an empty chat teaches the customer the shop does not answer, which is worse
 * than not offering it.
 */

type Props = {
  context: LineContext;
  /** `quiet` sits inside a card; `loud` is the main way out of a dead end. */
  tone?: 'quiet' | 'loud';
};

export function LineButton({ context, tone = 'quiet' }: Props) {
  if (!isLineConfigured) return null;

  return (
    <div className={`line-help line-${tone}`}>
      <a href={lineChatUrl()} target="_blank" rel="noreferrer">
        <MessageCircle size={17} /> {lineLabelFor(context)}
      </a>
      <small>{lineHintFor(context)}</small>
    </div>
  );
}
