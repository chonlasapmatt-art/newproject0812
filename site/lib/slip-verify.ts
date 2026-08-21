/**
 * Slip checking, in two layers.
 *
 * Layer 1 runs here and in the browser: it reads the QR every Thai bank prints
 * on a transfer slip and rejects the cheap attacks — a screenshot with no QR,
 * or a real slip replayed against a second order. It is a filter, not a
 * confirmation: nothing offline can prove money actually moved, because the
 * slip QR carries a lookup reference rather than the transaction itself.
 *
 * Layer 2 is `verifyWithProvider`, which asks a slip-verification provider to
 * resolve that reference against bank records. Only that answer confirms the
 * amount, the receiving account and that the transfer happened. It runs
 * server-side so the provider key never reaches the browser.
 */

export type SlipOutcome =
  | { status: 'confirmed'; reason: string }
  | { status: 'review'; code: ReviewCode; reason: string }
  | { status: 'rejected'; code: RejectCode; reason: string };

export type ReviewCode = 'no_qr' | 'provider_unavailable' | 'provider_unconfigured';
export type RejectCode = 'duplicate' | 'amount_mismatch' | 'wrong_account' | 'not_found';

/**
 * Normalise a decoded slip QR into a comparison key.
 *
 * Banks pad and case these differently between apps, so trim and upper-case
 * before any equality check. The payload is treated as opaque — its internal
 * structure is the provider's business, not ours.
 */
export function slipReference(qrPayload: string | null | undefined): string | null {
  if (!qrPayload) return null;
  const trimmed = qrPayload.trim().toUpperCase();
  return trimmed.length >= 8 ? trimmed : null;
}

export type PreCheckInput = {
  /** Raw string decoded from the QR on the uploaded slip image. */
  qrPayload: string | null;
  /** References already accepted against any order. */
  usedReferences: Iterable<string>;
};

/**
 * Offline pre-check. Never returns `confirmed` — passing here only means the
 * slip is worth sending to the provider (or to a human).
 */
export function preCheckSlip({ qrPayload, usedReferences }: PreCheckInput): SlipOutcome {
  const reference = slipReference(qrPayload);

  if (!reference) {
    return {
      status: 'review',
      code: 'no_qr',
      reason: 'อ่าน QR บนสลิปไม่ได้ ต้องให้พนักงานตรวจสอบ',
    };
  }

  const used = usedReferences instanceof Set ? usedReferences : new Set(usedReferences);
  if (used.has(reference)) {
    return {
      status: 'rejected',
      code: 'duplicate',
      reason: 'สลิปนี้ถูกใช้ยืนยันไปแล้ว',
    };
  }

  return {
    status: 'review',
    code: 'provider_unconfigured',
    reason: 'สลิปผ่านการตรวจเบื้องต้น รอยืนยันยอดกับธนาคาร',
  };
}

export type ProviderResult = {
  /** Amount the bank recorded, in baht. */
  amount: number;
  /** Receiving proxy the bank recorded, digits only. */
  receiverProxy?: string;
  /** Provider's own reference for the transaction. */
  reference: string;
};

export type ConfirmInput = {
  provider: ProviderResult;
  /** The exact figure the QR asked for, satang suffix included. */
  expectedAmount: number;
  /** Store PromptPay id, digits only. Skipped when not supplied. */
  expectedProxy?: string;
};

/**
 * Turn a provider answer into a decision.
 *
 * The amount must match to the satang: the suffix `uniqueAmount` adds is what
 * ties one transfer to one order, so a near-miss is a different payment.
 */
export function confirmAgainstProvider({
  provider,
  expectedAmount,
  expectedProxy,
}: ConfirmInput): SlipOutcome {
  const paid = Math.round(provider.amount * 100);
  const expected = Math.round(expectedAmount * 100);

  if (paid !== expected) {
    return {
      status: 'rejected',
      code: 'amount_mismatch',
      reason: `ยอดโอน ฿${provider.amount.toFixed(2)} ไม่ตรงกับยอดที่ต้องชำระ ฿${expectedAmount.toFixed(2)}`,
    };
  }

  if (expectedProxy && provider.receiverProxy) {
    const tail = (value: string) => value.replace(/\D/g, '').slice(-4);
    if (tail(provider.receiverProxy) !== tail(expectedProxy)) {
      return {
        status: 'rejected',
        code: 'wrong_account',
        reason: 'บัญชีปลายทางไม่ใช่บัญชีของร้าน',
      };
    }
  }

  return { status: 'confirmed', reason: 'ยืนยันยอดกับธนาคารเรียบร้อย' };
}
