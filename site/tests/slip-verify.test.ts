import { describe, expect, it } from 'vitest';
import {
  confirmAgainstProvider,
  preCheckSlip,
  slipReference,
} from '../lib/slip-verify';

const REF = '00550005010199230123456789012345678901';

describe('slipReference', () => {
  it('upper-cases and trims so the same slip compares equal across bank apps', () => {
    expect(slipReference('  abcdef123456  ')).toBe('ABCDEF123456');
  });

  it('treats an absent or implausibly short payload as unreadable', () => {
    expect(slipReference(null)).toBeNull();
    expect(slipReference('')).toBeNull();
    expect(slipReference('123')).toBeNull();
  });
});

describe('preCheckSlip', () => {
  it('sends an unreadable slip to a human rather than rejecting it', () => {
    const outcome = preCheckSlip({ qrPayload: null, usedReferences: [] });
    expect(outcome.status).toBe('review');
    expect(outcome).toMatchObject({ code: 'no_qr' });
  });

  it('rejects a slip already used against another order', () => {
    const outcome = preCheckSlip({ qrPayload: REF, usedReferences: [REF] });
    expect(outcome.status).toBe('rejected');
    expect(outcome).toMatchObject({ code: 'duplicate' });
  });

  it('matches a replayed slip regardless of case or padding', () => {
    const outcome = preCheckSlip({ qrPayload: ` ${REF.toLowerCase()} `, usedReferences: [REF] });
    expect(outcome).toMatchObject({ status: 'rejected', code: 'duplicate' });
  });

  it('never confirms on its own — a fresh slip still needs the bank', () => {
    const outcome = preCheckSlip({ qrPayload: REF, usedReferences: [] });
    expect(outcome.status).toBe('review');
    expect(outcome.status).not.toBe('confirmed');
  });

  it('accepts a Set of used references as well as an array', () => {
    const outcome = preCheckSlip({ qrPayload: REF, usedReferences: new Set([REF]) });
    expect(outcome).toMatchObject({ status: 'rejected', code: 'duplicate' });
  });
});

describe('confirmAgainstProvider', () => {
  const provider = { amount: 237.07, receiverProxy: '0066998756879', reference: 'X1' };

  it('confirms when the bank figure matches to the satang', () => {
    const outcome = confirmAgainstProvider({ provider, expectedAmount: 237.07 });
    expect(outcome.status).toBe('confirmed');
  });

  it('rejects a transfer that is short or over by even one satang', () => {
    expect(confirmAgainstProvider({ provider, expectedAmount: 237.08 })).toMatchObject({
      status: 'rejected',
      code: 'amount_mismatch',
    });
    expect(confirmAgainstProvider({ provider, expectedAmount: 237.06 })).toMatchObject({
      status: 'rejected',
      code: 'amount_mismatch',
    });
  });

  it('rejects a real transfer that landed in someone else\'s account', () => {
    const outcome = confirmAgainstProvider({
      provider,
      expectedAmount: 237.07,
      expectedProxy: '0812345678',
    });
    expect(outcome).toMatchObject({ status: 'rejected', code: 'wrong_account' });
  });

  it('matches the store account through differing proxy formats', () => {
    const outcome = confirmAgainstProvider({
      provider,
      expectedAmount: 237.07,
      expectedProxy: '0998756879',
    });
    expect(outcome.status).toBe('confirmed');
  });

  it('skips the account check when the provider does not report a receiver', () => {
    const outcome = confirmAgainstProvider({
      provider: { amount: 237.07, reference: 'X1' },
      expectedAmount: 237.07,
      expectedProxy: '0998756879',
    });
    expect(outcome.status).toBe('confirmed');
  });

  it('compares in satang, not floating point baht', () => {
    const outcome = confirmAgainstProvider({
      provider: { amount: 0.1 + 0.2, reference: 'X1' },
      expectedAmount: 0.3,
    });
    expect(outcome.status).toBe('confirmed');
  });
});
