import { describe, expect, it } from 'vitest';
import {
  buildPromptPayPayload,
  crc16,
  describeAmount,
  normalizeProxy,
  uniqueAmount,
} from '../lib/promptpay';

/**
 * Reference payload for mobile 0899999999 paying exactly 100.00 THB.
 *
 * Matching it byte-for-byte pins the field order (country before currency
 * before amount), the length prefixes and the CRC. The CRC was cross-checked
 * against an independent CRC-16/CCITT-FALSE implementation.
 */
const REFERENCE_DYNAMIC =
  '00020101021229370016A000000677010111011300668999999995802TH53037645406100.006304CB89';

describe('normalizeProxy', () => {
  it('converts a 10-digit mobile number to its 13-digit country-coded form', () => {
    expect(normalizeProxy('0899999999')).toEqual({ kind: 'mobile', value: '0066899999999' });
  });

  it('ignores separators in the input', () => {
    expect(normalizeProxy('089-999-9999')).toEqual({ kind: 'mobile', value: '0066899999999' });
  });

  it('accepts a number already carrying the 66 country code', () => {
    expect(normalizeProxy('66899999999')).toEqual({ kind: 'mobile', value: '0066899999999' });
  });

  it('routes 13 digits to the national id tag and 15 to the e-wallet tag', () => {
    expect(normalizeProxy('1234567890123').kind).toBe('nationalId');
    expect(normalizeProxy('123456789012345').kind).toBe('eWallet');
  });

  it('rejects a length that matches no PromptPay proxy', () => {
    expect(() => normalizeProxy('12345')).toThrow(/Unrecognised PromptPay id/);
  });
});

describe('crc16', () => {
  it('matches the CRC-16/CCITT-FALSE check value for "123456789"', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('always returns four hex digits', () => {
    expect(crc16('A')).toHaveLength(4);
  });
});

describe('buildPromptPayPayload', () => {
  it('reproduces the reference dynamic payload exactly', () => {
    expect(buildPromptPayPayload('0899999999', 100)).toBe(REFERENCE_DYNAMIC);
  });

  it('marks a payload carrying an amount as single-transaction (tag 01 = 12)', () => {
    expect(buildPromptPayPayload('0899999999', 245.07).startsWith('000201010212')).toBe(true);
  });

  it('marks an amount-free payload as reusable (tag 01 = 11)', () => {
    expect(buildPromptPayPayload('0899999999').startsWith('000201010211')).toBe(true);
  });

  it('embeds the amount with two decimal places', () => {
    expect(buildPromptPayPayload('0899999999', 245.07)).toContain('5406245.07');
    expect(buildPromptPayPayload('0899999999', 80)).toContain('540580.00');
  });

  it('carries the PromptPay AID and the normalised proxy', () => {
    const payload = buildPromptPayPayload('0899999999', 100);
    expect(payload).toContain('0016A000000677010111');
    expect(payload).toContain('01130066899999999');
  });

  it('appends a CRC that validates against the rest of the payload', () => {
    const payload = buildPromptPayPayload('0899999999', 137.42);
    const body = payload.slice(0, -4);
    expect(payload.slice(-4)).toBe(crc16(body));
  });

  it('rejects a non-positive amount', () => {
    expect(() => buildPromptPayPayload('0899999999', 0)).toThrow(/positive/);
    expect(() => buildPromptPayPayload('0899999999', -5)).toThrow(/positive/);
    expect(() => buildPromptPayPayload('0899999999', Number.NaN)).toThrow(/positive/);
  });
});

describe('uniqueAmount', () => {
  it('adds between 1 and 99 satang so the total is never a round baht', () => {
    for (const order of ['IMJ-1001', 'IMJ-1002', 'IMJ-2050', 'X']) {
      const amount = uniqueAmount(245, order);
      const satang = Math.round((amount - 245) * 100);
      expect(satang).toBeGreaterThanOrEqual(1);
      expect(satang).toBeLessThanOrEqual(99);
    }
  });

  it('is stable for the same order number, so retries reuse one amount', () => {
    expect(uniqueAmount(245, 'IMJ-1001')).toBe(uniqueAmount(245, 'IMJ-1001'));
  });

  it('separates orders that would otherwise owe an identical total', () => {
    expect(uniqueAmount(245, 'IMJ-1001')).not.toBe(uniqueAmount(245, 'IMJ-1002'));
  });

  it('never adds as much as a full baht', () => {
    expect(uniqueAmount(245, 'IMJ-1001') - 245).toBeLessThan(1);
  });
});

describe('describeAmount', () => {
  it('reports the payable total, the surcharge and a two-decimal display string', () => {
    const described = describeAmount(245, 'IMJ-1001');
    expect(described.baseTotal).toBe(245);
    expect(described.payable).toBe(245 + described.surcharge);
    expect(described.display).toMatch(/^\d+\.\d{2}$/);
  });
});

