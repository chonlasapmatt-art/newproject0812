'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { LayoutDashboard, Menu, ShoppingBag, X } from 'lucide-react';
import { useState } from 'react';
import { useCan } from '../lib/session';
import { SHOP_LINE, SHOP_LINE_URL, SHOP_PHONE, STORE_PROFILE } from '../lib/store-profile';
import { useCartStore } from '../stores/cart-store';
import { AccountMenu } from './account-menu';
import { BackToTop } from './back-to-top';
import { ThemeSwitch } from './theme-switch';
import { BootScreen } from './boot-screen';
import { ImJaiMark } from './brand-logo';
import { CartDrawer } from './cart-drawer';
import { FlyToCart } from './fly-to-cart';
import { PageChrome } from './page-chrome';
import { ImJaiAssistant } from './imjai-assistant';
import { RouteTransition } from './route-transition';
import { TactileLayer } from './tactile-layer';

/** Open to everyone, in the order a customer needs them. */
const links = [
  { href: '/', label: 'หน้าแรก' },
  { href: '/menu', label: 'เมนู' },
  { href: '/track', label: 'ติดตามออเดอร์' },
  { href: '/about', label: 'เกี่ยวกับเรา' },
  { href: '/contact', label: 'ติดต่อเรา' },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const openCart = useCartStore((state) => state.open);
  const lines = useCartStore((state) => state.lines);
  const [mobileOpen, setMobileOpen] = useState(false);
  // The dashboard link is only rendered for staff. The page guards itself as
  // well — hiding a link is presentation, not access control.
  const { isAdmin, isSignedIn } = useCan();

  // The dashboard is a working screen, not a page of the shop: the customer
  // assistant and the marketing footer are noise behind a till.
  const backOfHouse = pathname?.startsWith('/admin') ?? false;


  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <>
      <BootScreen />
      <PageChrome />

      <header className="site-header">
        <div className="site-header-inner">
          <Link prefetch={false} className="brand" href="/" aria-label="ImJai หน้าแรก">
            <ImJaiMark size={38} title={null} />
            <span><b>IMJAI</b><small>CAFE &amp; KITCHEN</small></span>
          </Link>
          <nav className="desktop-nav" aria-label="เมนูหลัก">
            {links.map((link) => <Link prefetch={false} className={pathname === link.href ? 'active' : ''} href={link.href} key={link.href}>{link.label}</Link>)}
            {isAdmin && <Link prefetch={false} className={`nav-admin ${pathname === '/admin' ? 'active' : ''}`} href="/admin"><LayoutDashboard size={14} /> แดชบอร์ด</Link>}
          </nav>
          <div className="header-actions">
            <ThemeSwitch />
            <AccountMenu />
            <button className="cart-button" onClick={openCart} aria-label={`เปิดตะกร้า มี ${count} รายการ`}>
              <ShoppingBag size={19} /><span className="cart-label">ตะกร้า</span>{count > 0 && <b key={count}>{count}</b>}
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
              <nav>{[...links, ...(isAdmin ? [{ href: '/admin', label: 'แดชบอร์ด' }] : []), { href: '/account', label: isSignedIn ? 'บัญชีของฉัน' : 'เข้าสู่ระบบ' }].map((link) => <Link prefetch={false} href={link.href} onClick={() => setMobileOpen(false)} key={link.href}>{link.label}<span>↗</span></Link>)}</nav>
              <div className="mobile-nav-note"><b>{STORE_PROFILE.hours.note}</b><span>{STORE_PROFILE.hours.everyday}</span><span>LINE {SHOP_LINE}</span></div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <RouteTransition>{children}</RouteTransition>
      <CartDrawer />
      <FlyToCart />
      <TactileLayer />
      <BackToTop />
      {!backOfHouse && <ImJaiAssistant />}
      {!backOfHouse && (
        <footer className="site-footer">
          <div className="footer-brand">
            <ImJaiMark size={44} title={null} />
            <div><b>{STORE_PROFILE.name}</b><small>{STORE_PROFILE.tagline}</small></div>
          </div>
          <div>
            <b>แวะมาหาเรา</b>
            <span>{STORE_PROFILE.location.address}</span>
            <span>{STORE_PROFILE.hours.note} {STORE_PROFILE.hours.everyday}</span>
          </div>
          <div>
            <b>ติดต่อ</b>
            <a href={`tel:${SHOP_PHONE.replace(/\D/g, '')}`}>{SHOP_PHONE}</a>
            <a href={SHOP_LINE_URL} rel="noreferrer" target="_blank">LINE {SHOP_LINE}</a>
          </div>
          {/* story.since is stated in the Buddhist era, as the about page shows it. */}
          <p>© {STORE_PROFILE.story.since - 543} {STORE_PROFILE.name}</p>
        </footer>
      )}
    </>
  );
}
