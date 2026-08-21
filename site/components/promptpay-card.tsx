'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { User } from 'lucide-react';

/**
 * The scannable payment card shown at checkout.
 *
 * Laid out like the printed counter standee — scheme header, QR, account name
 * in a ruled footer — so a customer who has paid in the shop recognises it.
 * Unlike the printed one the code carries the exact amount for this order, so
 * the payer cannot key in the wrong sum.
 */

type Props = {
  /** EMVCo payload from `buildPromptPayPayload`. */
  payload: string;
  /** Amount to display, already formatted to two decimals. */
  amountDisplay: string;
  /** Registered PromptPay account holder. */
  accountName: string;
  /** Shown under the amount to explain the odd satang. */
  orderNumber?: string;
};

export function PromptPayCard({ payload, amountDisplay, accountName, orderNumber }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toString(payload, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 0,
      color: { dark: '#1c1917', light: '#0000' },
    })
      .then((out) => active && setSvg(out))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [payload]);

  return (
    <figure className="ppay-card">
      <div className="ppay-scheme">
        <span className="ppay-scheme-mark" aria-hidden>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <rect x="2" y="2" width="9" height="9" rx="2" fill="#fff" />
            <rect x="13" y="2" width="9" height="9" rx="2" fill="#4aa3a1" />
            <rect x="2" y="13" width="9" height="9" rx="2" fill="#4aa3a1" />
            <rect x="13" y="13" width="9" height="9" rx="2" fill="#fff" />
          </svg>
        </span>
        <b>
          THAI QR <span>PAYMENT</span>
        </b>
      </div>

      <div className="ppay-body">
        <span className="ppay-brand">
          PromptPay<i>พร้อมเพย์</i>
        </span>

        <div className="ppay-qr">
          {svg && !failed ? (
            // The library returns a self-contained <svg>; it never includes script.
            <div aria-label={`คิวอาร์โค้ดพร้อมเพย์ ยอด ${amountDisplay} บาท`} role="img" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <p className="ppay-qr-fallback">
              {failed ? 'สร้าง QR ไม่สำเร็จ กรุณาลองใหม่' : 'กำลังสร้าง QR…'}
            </p>
          )}
        </div>

        <div className="ppay-amount">
          <small>ยอดที่ต้องโอน</small>
          <b>฿{amountDisplay}</b>
          {orderNumber && <em>โอนให้ตรงยอดนี้ เศษสตางค์คือรหัสออเดอร์ {orderNumber}</em>}
        </div>
      </div>

      <figcaption className="ppay-account">
        <User size={16} aria-hidden />
        <span>ชื่อบัญชี : {accountName}</span>
      </figcaption>
    </figure>
  );
}
