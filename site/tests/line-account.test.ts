import { describe, expect, it } from 'vitest';
import { lineAccountLinkUrl, validLineLinkToken } from '../lib/line-account';

describe('LINE account linking', () => {
  const token = 'abcdefghijklmnopqrstuvwxyz0123456789_ABCD';
  const nonce = 'a'.repeat(64);

  it('builds the official account-link confirmation URL', () => {
    expect(lineAccountLinkUrl(token, nonce)).toBe(
      `https://access.line.me/dialog/bot/accountLink?linkToken=${token}&nonce=${nonce}`,
    );
  });

  it('rejects reflected or malformed link tokens', () => {
    expect(validLineLinkToken(token)).toBe(true);
    expect(validLineLinkToken('short')).toBe(false);
    expect(validLineLinkToken('x'.repeat(20) + '&redirect=https://evil.example')).toBe(false);
    expect(() => lineAccountLinkUrl(token, 'not-a-nonce')).toThrow('invalid_line_link');
  });
});
