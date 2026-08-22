'use client';

import { isPreviewMode } from './session';

/**
 * Who may open the dashboard before there is a database.
 *
 * This is a lock on a static site, so it is worth being exact about what it
 * does. Everything the browser runs is downloadable, which means the key below
 * is readable by anyone willing to open the built JavaScript or the repository.
 * It stops the case the shop actually has — handing someone the site link and
 * not handing them the back office with it — and it does not pretend to stop
 * anyone determined.
 *
 * The real lock is Supabase. Once a project is configured, roles come from the
 * database with row-level security behind them, nothing in the browser can
 * grant one, and this file stops being consulted at all.
 *
 * To change the key: edit DEFAULT_KEY, or set NEXT_PUBLIC_DASHBOARD_KEY as a
 * repository variable, which wins. Changing it signs every browser out of the
 * dashboard, including this one.
 */

const DEFAULT_KEY = 'imjai-wdhg-7x0e-r4hu';

export const DASHBOARD_KEY = process.env.NEXT_PUBLIC_DASHBOARD_KEY || DEFAULT_KEY;

/** Stored per browser so the key is typed once, not on every visit. */
const UNLOCKED_KEY = 'imjai-dashboard-unlocked';

const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

export function subscribeUnlocked(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * The stored value is the key itself, not a flag. Rotating the key therefore
 * locks every browser that held the old one, which is the whole point of being
 * able to rotate it.
 */
export function isUnlocked(): boolean {
  if (!isPreviewMode) return false;
  try {
    return localStorage.getItem(UNLOCKED_KEY) === DASHBOARD_KEY;
  } catch {
    return false;
  }
}

export function getUnlockedSnapshot(): boolean {
  return isUnlocked();
}

/** Server render never has storage, and must not flash the dashboard. */
export const getUnlockedServerSnapshot = () => false;

export function unlock(attempt: string): boolean {
  if (!isPreviewMode) return false;
  if (attempt.trim() !== DASHBOARD_KEY) return false;
  try {
    localStorage.setItem(UNLOCKED_KEY, DASHBOARD_KEY);
  } catch {
    return false;
  }
  announce();
  return true;
}

export function lock() {
  try {
    localStorage.removeItem(UNLOCKED_KEY);
  } catch {
    // Nothing stored means nothing to clear.
  }
  announce();
}
