'use client';

import { MessageCircle } from 'lucide-react';
import { lineChatUrl, lineHintFor, lineLabelFor, type LineContext } from '../lib/line-oa';
import { useStoreSettings } from '../lib/store-settings';

/**
 * The way out when something goes wrong.
 *
 * Placed where an order actually stalls — at the payment step, on the tracking
 * page, and on contact — rather than only in the footer. Someone whose slip was
 * rejected at nine at night should not have to go looking for how to ask.
 *
 * Renders nothing until the shop has saved a LINE id. A button that opens an
 * empty chat teaches the customer the shop does not answer, which is worse
 * than not offering it at all.
 */

type Props = {
  context: LineContext;
  /** `quiet` sits inside a card; `loud` is the main way out of a dead end. */
  tone?: 'quiet' | 'loud';
};

export function LineButton({ context, tone = 'quiet' }: Props) {
  const settings = useStoreSettings();
  const url = lineChatUrl(settings.lineOaId, settings.lineOaLink);
  if (!url) return null;

  return (
    <div className={`line-help line-${tone}`}>
      <a href={url} target="_blank" rel="noreferrer">
        <MessageCircle size={17} /> {lineLabelFor(context)}
      </a>
      <small>{lineHintFor(context)}</small>
    </div>
  );
}
