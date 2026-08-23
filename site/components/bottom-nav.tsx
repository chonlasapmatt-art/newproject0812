'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { CircleUserRound, Home, Package, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { useMotionOK } from '../lib/motion';
import { useCartStore } from '../stores/cart-store';

/**
 * The five things a customer reaches for most, one thumb-width away.
 *
 * The desktop header's hamburger drawer stays for everything else, but on a
 * phone that drawer costs two taps to reach the menu or an order — this puts
 * the five most common destinations at the bottom, where a thumb already is.
 * Cart is a button, not a link: it opens the existing drawer in place rather
 * than navigating, so a customer never loses the page they were browsing.
 */

const LINKS = [
  { href: '/', label: 'หน้าแรก', icon: Home, match: (path: string) => path === '/' },
  { href: '/menu', label: 'เมนู', icon: UtensilsCrossed, match: (path: string) => path.startsWith('/menu') },
  { href: '/track', label: 'ออเดอร์', icon: Package, match: (path: string) => path.startsWith('/track') },
  { href: '/account', label: 'บัญชี', icon: CircleUserRound, match: (path: string) => path.startsWith('/account') },
];

export function BottomNav() {
  const pathname = usePathname() ?? '/';
  const motionOK = useMotionOK();
  const lines = useCartStore((state) => state.lines);
  const openCart = useCartStore((state) => state.open);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  const pill = (active: boolean) =>
    active && (
      <motion.span
        className="bottom-nav-pill"
        layoutId="bottom-nav-pill"
        transition={motionOK ? { type: 'spring', stiffness: 380, damping: 32 } : { duration: 0 }}
      />
    );

  return (
    <nav className="bottom-nav" aria-label="เมนูหลักสำหรับมือถือ">
      {LINKS.slice(0, 2).map((link) => {
        const active = link.match(pathname);
        const Icon = link.icon;
        return (
          <Link prefetch={false} key={link.href} href={link.href} className={`bottom-nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
            {pill(active)}
            <Icon size={20} aria-hidden />
            <small>{link.label}</small>
          </Link>
        );
      })}

      <button type="button" className="bottom-nav-item" onClick={openCart} aria-label={`เปิดตะกร้า มี ${count} รายการ`}>
        <span className="bottom-nav-cart-icon">
          <ShoppingBag size={20} aria-hidden />
          {count > 0 && <b key={count}>{count}</b>}
        </span>
        <small>ตะกร้า</small>
      </button>

      {LINKS.slice(2).map((link) => {
        const active = link.match(pathname);
        const Icon = link.icon;
        return (
          <Link prefetch={false} key={link.href} href={link.href} className={`bottom-nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
            {pill(active)}
            <Icon size={20} aria-hidden />
            <small>{link.label}</small>
          </Link>
        );
      })}
    </nav>
  );
}
