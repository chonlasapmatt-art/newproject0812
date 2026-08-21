/**
 * Dynamic PromptPay QR payloads (EMVCo Merchant-Presented Mode).
 *
 * The payload is a chain of TLV fields — a two-digit tag, a two-digit length,
 * then the value — closed by a CRC over everything before it. Embedding the
 * amount makes the QR single-use for one exact sum, so a customer cannot scan
 * it and transfer the wrong total.
 *
 * Reference: EMVCo QR Code Specification for Payment Systems (MPM) and the
 * Bank of Thailand Thai QR Payment standard.
 */

const AID_PROMPTPAY = 'A000000677010111';

const TAG = {
  payloadFormat: '00',
  initMethod: '01',
  merchantAccount: '29',
  currency: '53',
  amount: '54',
  country: '58',
  crc: '63',
} as const;

/** Sub-tags inside the PromptPay merchant account template (tag 29). */
const PROXY_TAG = {
  aid: '00',
  mobile: '01',
  nationalId: '02',
  eWallet: '03',
} as const;

export type PromptPayProxy = {
  /** Which proxy tag the target is registered under. */
  kind: 'mobile' | 'nationalId' | 'eWallet';
  /** Digits formatted exactly as the tag requires. */
  value: string;
};

/** A TLV field: tag, zero-padded byte length, then the value. */
function field(tag: string, value: string): string {
  return tag + String(value.length).padStart(2, '0') + value;
}

/**
 * CRC-16/CCITT-FALSE — polynomial 0x1021, initial value 0xFFFF, no reflection.
 * Returned as four uppercase hex digits.
 */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Classify a PromptPay target by digit count and normalise it for its tag.
 *
 * Mobile numbers travel as a 13-digit string: country code 66 replaces the
 * trunk 0, left-padded with zeros. National IDs and e-wallet IDs are used
 * as-is at 13 and 15 digits.
 */
export function normalizeProxy(raw: string): PromptPayProxy {
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10 && digits.startsWith('0')) {
    return { kind: 'mobile', value: `0066${digits.slice(1)}` };
  }
  if (digits.length === 9) {
    return { kind: 'mobile', value: `0066${digits}` };
  }
  if (digits.length === 11 && digits.startsWith('66')) {
    return { kind: 'mobile', value: `0066${digits.slice(2)}` };
  }
  if (digits.length === 13) {
    return { kind: 'nationalId', value: digits };
  }
  if (digits.length === 15) {
    return { kind: 'eWallet', value: digits };
  }

  throw new Error(
    `Unrecognised PromptPay id: expected a 10-digit mobile number, 13-digit national id or 15-digit e-wallet id, got ${digits.length} digits`,
  );
}

/**
 * Build the QR payload string for one payment.
 *
 * Omitting `amount` produces a static QR the payer types a sum into; passing
 * one produces a dynamic, single-transaction QR carrying that exact sum.
 */
export function buildPromptPayPayload(promptPayId: string, amount?: number): string {
  const proxy = normalizeProxy(promptPayId);

  const merchantAccount =
    field(PROXY_TAG.aid, AID_PROMPTPAY) + field(PROXY_TAG[proxy.kind], proxy.value);

  const oneTime = typeof amount === 'number';
  if (oneTime && !(amount > 0 && Number.isFinite(amount))) {
    throw new Error(`Amount must be a positive, finite number, got ${amount}`);
  }

  // Field order follows the Thai QR payloads banks issue in practice —
  // country precedes currency and amount — rather than plain ascending tags,
  // so the output is byte-identical to what Thai banking apps already accept.
  const body =
    field(TAG.payloadFormat, '01') +
    // 11 = reusable (static), 12 = single transaction (dynamic).
    field(TAG.initMethod, oneTime ? '12' : '11') +
    field(TAG.merchantAccount, merchantAccount) +
    field(TAG.country, 'TH') +
    field(TAG.currency, '764') +
    (oneTime ? field(TAG.amount, amount.toFixed(2)) : '');

  // The CRC covers the payload including its own tag and length.
  const withCrcHeader = `${body}${TAG.crc}04`;
  return withCrcHeader + crc16(withCrcHeader);
}

/**
 * Give each order a distinct satang suffix so an incoming transfer maps to
 * exactly one order.
 *
 * Two customers ordering the same items would otherwise owe an identical
 * amount, leaving matching ambiguous. The suffix is derived from the order
 * number, so it is stable across retries and adds at most 0.99 baht.
 */
export function uniqueAmount(baseTotal: number, orderNumber: string): number {
  let hash = 0;
  for (let i = 0; i < orderNumber.length; i += 1) {
    hash = (hash * 31 + orderNumber.charCodeAt(i)) % 99;
  }
  const satang = hash + 1; // 1..99, never a round baht
  return Math.round(baseTotal * 100 + satang) / 100;
}

/** Split a total into the parts the checkout UI shows separately. */
export function describeAmount(baseTotal: number, orderNumber: string) {
  const payable = uniqueAmount(baseTotal, orderNumber);
  return {
    baseTotal,
    payable,
    surcharge: Math.round((payable - baseTotal) * 100) / 100,
    display: payable.toFixed(2),
  };
}
