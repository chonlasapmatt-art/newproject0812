'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CircleUserRound, Menu, ShoppingBag, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCartStore } from '../stores/cart-store';
import { ImJaiMark } from './brand-logo';
import { CartDrawer } from './cart-drawer';
import { ImJaiAssistant } from './imjai-assistant';

const links = [
  { href: '/', label: 'หน้าแรก' },
  { href: '/menu', label: 'เมนู' },
  { href: '/track', label: 'ติดตามออเดอร์' },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const openCart = useCartStore((state) => state.open);
  const lines = useCartStore((state) => state.lines);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [intro, setIntro] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let closeTimer = 0;
    const startTimer = window.setTimeout(() => {
      if (sessionStorage.getItem('imjai-intro-seen')) return;
      sessionStorage.setItem('imjai-intro-seen', '1');
      setIntro(true);
      closeTimer = window.setTimeout(() => setIntro(false), reducedMotion ? 80 : 1050);
    }, 0);
    return () => { window.clearTimeout(startTimer); window.clearTimeout(closeTimer); };
  }, [reducedMotion]);

  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <>
      <AnimatePresence>
        {intro && (
          <motion.div className="intro-screen" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .25 }}>
            <div className="intro-logo">
              <span className="intro-steam intro-steam-a" />
              <span className="intro-steam intro-steam-b" />
              <span>อ</span>
            </div>
            <b>IMJAI</b><small>CAFE &amp; KITCHEN</small>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="site-header">
        <div className="site-header-inner">
          <Link prefetch={false} className="brand" href="/" aria-label="ImJai หน้าแรก">
            <ImJaiMark size={38} title={null} />
            <span><b>IMJAI</b><small>CAFE &amp; KITCHEN</small></span>
          </Link>
          <nav className="desktop-nav" aria-label="เมนูหลัก">
            {links.map((link) => <Link prefetch={false} className={pathname === link.href ? 'active' : ''} href={link.href} key={link.href}>{link.label}</Link>)}
            <Link prefetch={false} className={pathname === '/account' ? 'active' : ''} href="/account">สมาชิก</Link>
          </nav>
          <div className="header-actions">
            <Link prefetch={false} className="icon-button account-button" href="/account" aria-label="บัญชีสมาชิก"><CircleUserRound size={21} /></Link>
            <button className="cart-button" onClick={openCart} aria-label={`เปิดตะกร้า มี ${count} รายการ`}>
              <ShoppingBag size={19} /><span className="cart-label">ตะกร้า</span>{count > 0 && <b>{count}</b>}
            </button>
            <button className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="เปิดเมนู"><Menu size={22} /></button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button className="drawer-backdrop" aria-label="ปิดเมนู" onClick={() => setMobileOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.aside className="mobile-nav" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
              <div className="drawer-title"><span>เมนู</span><button className="icon-button" onClick={() => setMobileOpen(false)} aria-label="ปิดเมนู"><X /></button></div>
              <nav>{[...links, { href: '/account', label: 'สมาชิก' }].map((link) => <Link prefetch={false} href={link.href} onClick={() => setMobileOpen(false)} key={link.href}>{link.label}<span>↗</span></Link>)}</nav>
              <div className="mobile-nav-note"><b>เปิดทุกวัน</b><span>07:00–20:00 น.</span><span>LINE @imjaicafe</span></div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {children}
      <CartDrawer />
      <ImJaiAssistant />
      <footer className="site-footer">
        <div className="footer-brand"><ImJaiMark size={44} title={null} /><div><b>ImJai Cafe &amp; Kitchen</b><small>รสชาติของความอิ่มใจ ในทุกคำที่ทาน</small></div></div>
        <div><b>แวะมาหาเรา</b><span>88/12 ถนนสุขุมวิท เขตวัฒนา กรุงเทพฯ</span><span>ทุกวัน 07:00–20:00 น.</span></div>
        <div><b>ติดต่อ</b><a href="tel:021234567">02-123-4567</a><a href="https://line.me/R/ti/p/%40imjaicafe" rel="noreferrer" target="_blank">LINE @imjaicafe</a></div>
        <p>© 2026 ImJai Cafe &amp; Kitchen</p>
      </footer>
    </>
  );
}
