'use client';

import { useSyncExternalStore } from 'react';

/**
 * How bright the site is.
 *
 * Three choices rather than the usual two, because the shop asked for
 * something that stops the glare rather than something that inverts the page:
 * "นวลตา" keeps the warm room and takes the pure white out of it, which is
 * where most of the glare actually comes from. Dark is there for the people
 * who want it, and following the system is the default so a phone already set
 * to dark at night does the right thing without being asked.
 *
 * The choice lives outside React and is written straight onto <html> as a
 * data-theme attribute. The stylesheet does the rest: every themeable colour
 * is a custom property, so a theme is a short list of overrides, not a second
 * stylesheet that could drift.
 */

export type Theme = 'system' | 'light' | 'soft' | 'dark';

export const THEMES: { id: Theme; label: string; hint: string }[] = [
  { id: 'system', label: 'ตามเครื่อง', hint: 'สลับเองตามการตั้งค่าของอุปกรณ์' },
  { id: 'light', label: 'สว่าง', hint: 'โทนกระดาษสว่าง แบบดั้งเดิมของร้าน' },
  { id: 'soft', label: 'นวลตา', hint: 'ลดความจ้าลง อ่านนาน ๆ สบายตากว่า' },
  { id: 'dark', label: 'มืด', hint: 'พื้นเข้มโทนอุ่น เหมาะกับที่แสงน้อย' },
];

export const STORAGE_KEY = 'imjai-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

let choice: Theme = 'system';
let loaded = false;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

function read(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'soft' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** What `system` resolves to right now. */
export function resolve(value: Theme): Exclude<Theme, 'system'> {
  if (value !== 'system') return value;
  try {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function paint() {
  document.documentElement.dataset.theme = resolve(choice);
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);

  if (!loaded) {
    loaded = true;
    choice = read();
    paint();
    // Following the system means following it as it changes, not only at load.
    try {
      window.matchMedia(DARK_QUERY).addEventListener('change', () => {
        if (choice === 'system') {
          paint();
          announce();
        }
      });
    } catch {
      // No matchMedia: the explicit choices still work.
    }
  }

  return () => {
    listeners.delete(onChange);
  };
}

const snapshot = () => choice;
const serverSnapshot = (): Theme => 'system';

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function setTheme(next: Theme) {
  choice = next;
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage refused; the choice still applies for this page.
  }
  paint();
  announce();
}
