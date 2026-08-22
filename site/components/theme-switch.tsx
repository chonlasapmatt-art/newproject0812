'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Check, Monitor, Moon, Sun, SunDim } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EASE, useMotionOK } from '../lib/motion';
import { THEMES, setTheme, useTheme, type Theme } from '../lib/theme';

/**
 * The brightness control in the header.
 *
 * Four choices behind one button rather than a two-way toggle, because the
 * useful middle option — warm, but without the pure white — is the one a
 * light/dark switch cannot express, and it is the one the shop asked for.
 */

const ICONS: Record<Theme, typeof Sun> = {
  system: Monitor,
  light: Sun,
  soft: SunDim,
  dark: Moon,
};

export function ThemeSwitch() {
  const theme = useTheme();
  const motionOK = useMotionOK();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

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

  const Icon = ICONS[theme];

  return (
    <div className="theme-switch" ref={wrapRef}>
      <button
        type="button"
        className="icon-button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="เปลี่ยนโทนสีเว็บ"
      >
        <Icon size={20} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="theme-panel"
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: motionOK ? 0.2 : 0.01, ease: EASE.enter }}
          >
            <p className="theme-panel-head">โทนสีเว็บ</p>
            {THEMES.map((entry) => {
              const EntryIcon = ICONS[entry.id];
              return (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={theme === entry.id}
                  key={entry.id}
                  className={theme === entry.id ? 'is-current' : ''}
                  onClick={() => {
                    setTheme(entry.id);
                    setOpen(false);
                  }}
                >
                  <EntryIcon size={17} />
                  <span>
                    <b>{entry.label}</b>
                    <small>{entry.hint}</small>
                  </span>
                  {theme === entry.id && <Check size={15} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
