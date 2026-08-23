'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { cartTotals, lineTotal } from '../lib/cart';
import { paced, useMotionOK } from '../lib/motion';
import { showToast } from '../lib/toast';
import { useCartStore } from '../stores/cart-store';

const money = (value: number) => `฿${value.toLocaleString('th-TH')}`;

export function CartDrawer() {
  const { lines, isOpen, coupon, close, updateQuantity, remove, setCoupon } = useCartStore();
  const totals = cartTotals(lines, false, coupon);
  const motionOK = useMotionOK();

  const onRemove = (id: string, name: string) => {
    remove(id);
    showToast(`นำ${name}ออกจากตะกร้าแล้ว`, 'info');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button className="drawer-backdrop" aria-label="ปิดตะกร้า" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside className="cart-drawer" aria-label="ตะกร้าสินค้า" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
            <div className="drawer-title"><span>ตะกร้าของคุณ <small>{lines.length ? `${lines.length} รายการ` : ''}</small></span><button className="icon-button" onClick={close} aria-label="ปิดตะกร้า"><X /></button></div>
            {lines.length === 0 ? (
              <div className="empty-cart"><span><ShoppingBag /></span><h2>ยังไม่มีเมนูในตะกร้า</h2><p>เลือกของอร่อยที่อยากทาน แล้วกลับมาเช็กตะกร้าได้ตรงนี้</p><Link prefetch={false} className="primary-button" href="/menu" onClick={close}>เลือกดูเมนู</Link></div>
            ) : (
              <>
                <div className="cart-lines">
                  <AnimatePresence initial={false}>
                    {lines.map((line) => (
                      <motion.article
                        className="cart-line"
                        key={line.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0, transition: { duration: paced(0.18, motionOK) } }}
                        transition={{ duration: paced(0.26, motionOK) }}
                      >
                        <div className="cart-line-art">{line.emoji}</div>
                        <div className="cart-line-copy">
                          <div className="cart-line-head"><h3>{line.name}</h3><button onClick={() => onRemove(line.id, line.name)} aria-label={`ลบ ${line.name}`}><Trash2 size={16} /></button></div>
                          {!!line.options?.length && <p>{line.options.join(' · ')}</p>}
                          {!!line.addOns?.length && <p>เพิ่ม {line.addOns.map((item) => item.name).join(', ')}</p>}
                          {line.note && <p>หมายเหตุ: {line.note}</p>}
                          <div className="cart-line-foot">
                            <div className="quantity-stepper"><button onClick={() => updateQuantity(line.id, line.quantity - 1)} aria-label="ลดจำนวน"><Minus size={14} /></button><span>{line.quantity}</span><button onClick={() => updateQuantity(line.id, line.quantity + 1)} aria-label="เพิ่มจำนวน"><Plus size={14} /></button></div>
                            <b>{money(lineTotal(line))}</b>
                          </div>
                        </div>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="cart-summary">
                  <label htmlFor="cart-coupon">คูปอง</label>
                  <div className="coupon-row"><input id="cart-coupon" value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder="ลองใช้ IMJAI15" /><span>{totals.discount ? `ลด ${money(totals.discount)}` : 'ใช้เมื่อครบ ฿200'}</span></div>
                  <dl><div><dt>ยอดสินค้า</dt><dd>{money(totals.subtotal)}</dd></div>{totals.discount > 0 && <div className="discount"><dt>ส่วนลด</dt><dd>-{money(totals.discount)}</dd></div>}<div className="cart-total"><dt>รวม</dt><dd>{money(totals.total)}</dd></div></dl>
                  <Link prefetch={false} className="checkout-button" href="/checkout" onClick={close}>ไปชำระเงิน <span>→</span></Link>
                  <p className="secure-note">ยอดเงินจริงจะคำนวณซ้ำที่ระบบร้านก่อนสร้างออเดอร์</p>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
