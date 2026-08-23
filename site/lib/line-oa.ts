/**
 * The shop's LINE account, reachable from wherever a customer gets stuck.
 *
 * A café's real support channel is LINE, not a contact form — the shop reads
 * it all day and the customer already has the app open. So rather than one
 * link on the contact page, the button belongs at the three places an order
 * goes wrong: paying, waiting, and after something has already happened.
 *
 * The id is a build setting because a static site has no server to read
 * configuration from. Until it is set every button stays hidden: a LINE link
 * that opens nothing is worse than no link, and the dashboard says plainly
 * that it has not been configured yet.
 */

/** The shop's LINE basic id, with or without the leading @. */
const RAW_ID = (process.env.NEXT_PUBLIC_LINE_OA_ID ?? '').trim();

/** A lin.ee short link, if the shop uses one instead of a basic id. */
const SHORT_LINK = (process.env.NEXT_PUBLIC_LINE_OA_LINK ?? '').trim();

export const isLineConfigured = Boolean(RAW_ID || SHORT_LINK);

/** The id as LINE writes it, e.g. `@imjaicafe`. */
export const lineBasicId = RAW_ID ? (RAW_ID.startsWith('@') ? RAW_ID : `@${RAW_ID}`) : '';

/**
 * Where the LINE button goes.
 *
 * A short link is used as given. Otherwise the basic id becomes an add-friend
 * URL, which opens the chat for someone who has already added the shop and
 * offers to add it for someone who has not — the right behaviour for both.
 */
export function lineChatUrl(): string {
  if (SHORT_LINK) return SHORT_LINK;
  if (!lineBasicId) return '';
  return `https://line.me/R/ti/p/${encodeURIComponent(lineBasicId)}`;
}

export type LineContext =
  | { kind: 'payment'; orderNumber?: string }
  | { kind: 'order'; orderNumber: string }
  | { kind: 'general' };

/** What to say on the button, in the words that fit where it sits. */
export function lineLabelFor(context: LineContext): string {
  if (context.kind === 'payment') return 'ชำระเงินมีปัญหา? ทักไลน์ร้าน';
  if (context.kind === 'order') return 'สอบถามออเดอร์นี้ทางไลน์';
  return 'ทักร้านทางไลน์';
}

/**
 * What the customer should tell the shop.
 *
 * LINE cannot prefill a message to an official account from a link, so this is
 * shown next to the button instead. Naming the order number is the difference
 * between the shop answering in one reply and asking three questions first.
 */
export function lineHintFor(context: LineContext): string {
  if (context.kind === 'order' || (context.kind === 'payment' && context.orderNumber)) {
    return `แจ้งเลขออเดอร์ ${context.orderNumber} ให้ร้านด้วยนะคะ จะได้ตอบได้ทันที`;
  }
  return 'ทักมาได้เลย ร้านตอบในเวลาทำการ 07:00–20:00 น.';
}
