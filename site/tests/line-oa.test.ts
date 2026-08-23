import { describe, expect, it } from 'vitest';
import { lineBasicId, lineChatUrl, lineHintFor } from '../lib/line-oa';

describe('the shop LINE account', () => {
  // Blank means "show no button". A LINE link that opens nothing teaches the
  // customer the shop does not answer.
  it('produces no link until the shop has saved an id', () => {
    expect(lineChatUrl('', '')).toBe('');
    expect(lineChatUrl('   ', '  ')).toBe('');
  });

  it('accepts the id with or without the @ the shop happens to type', () => {
    expect(lineBasicId('imjaicafe')).toBe('@imjaicafe');
    expect(lineBasicId('@imjaicafe')).toBe('@imjaicafe');
    expect(lineBasicId('  imjaicafe  ')).toBe('@imjaicafe');
  });

  it('builds an add-friend link that works for new and existing followers', () => {
    expect(lineChatUrl('@imjaicafe')).toBe('https://line.me/R/ti/p/%40imjaicafe');
    expect(lineChatUrl('imjaicafe')).toBe('https://line.me/R/ti/p/%40imjaicafe');
  });

  it('prefers a lin.ee short link when the shop has pasted one', () => {
    expect(lineChatUrl('@ignored', 'https://lin.ee/AbCdEf')).toBe('https://lin.ee/AbCdEf');
  });

  it('tells the customer to quote the order number when there is one', () => {
    expect(lineHintFor({ kind: 'order', orderNumber: 'IMJ-0042' })).toContain('IMJ-0042');
    expect(lineHintFor({ kind: 'payment', orderNumber: 'IMJ-0042' })).toContain('IMJ-0042');
    expect(lineHintFor({ kind: 'general' })).not.toContain('IMJ-');
  });
});
