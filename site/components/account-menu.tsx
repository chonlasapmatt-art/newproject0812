'use client';

import { AnimatePresence, motion } from 'motion/react';
import { CircleUserRound, LayoutDashboard, LogOut, Package, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { EASE, useMotionOK } from '../lib/motion';
import { useSession, useSignOut } from '../lib/session';

/**
 * The account control in the header.
 *
 * Signed out it is a plain link to the sign-in page — one tap, no menu in the
 * way. Signed in it opens a small panel, because that is where signing out has
 * to live: a customer who cannot find the way out of an account does not trust
 * the site with their address.
 */

export function AccountMenu() {
  const session = useSession();
  const signOut = useSignOut();
  const motionOK = useMotionOK();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // A menu that survives a click elsewhere, or Escape, is a menu that traps.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (session.status !== 'signed-in' || !session.user) {
    return (
      <Link prefetch={false} className="icon-button account-button" href="/account" aria-label="เข้าสู่ระบบ">
        <CircleUserRound size={21} />
      </Link>
    );
  }

  const { user, role } = session;
  const initial = (user.name || user.email).slice(0, 1).toUpperCase();

  return (
    <div className="account-menu" ref={wrapRef}>
      <button
        type="button"
        className="account-chip"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="account-initial" aria-hidden>{initial}</span>
        <span className="account-name">{user.name}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="account-panel"
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: motionOK ? 0.2 : 0.01, ease: EASE.enter }}
          >
            <div className="account-panel-head">
              <b>{user.name}</b>
              <small>{user.email}</small>
              {!user.verified && <em>โหมดพรีวิว — ยังไม่ได้เชื่อมฐานข้อมูล</em>}
            </div>

            <Link prefetch={false} role="menuitem" href="/account" onClick={() => setOpen(false)}>
              <UserRound size={16} /> บัญชีของฉัน
            </Link>
            <Link prefetch={false} role="menuitem" href="/track" onClick={() => setOpen(false)}>
              <Package size={16} /> ออเดอร์ของฉัน
            </Link>
            {role === 'admin' && (
              <Link prefetch={false} role="menuitem" href="/admin" onClick={() => setOpen(false)}>
                <LayoutDashboard size={16} /> แดชบอร์ดร้าน
              </Link>
            )}

            <button
              type="button"
              role="menuitem"
              className="account-signout"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              <LogOut size={16} /> ออกจากระบบ
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
