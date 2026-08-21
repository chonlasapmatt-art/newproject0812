'use client';

import { useSyncExternalStore } from 'react';
import { MENU_ITEMS, type MenuItem } from './catalog';

/**
 * The shop's own corrections to the menu.
 *
 * `catalog.ts` is the printed menu — it ships with the build and everyone gets
 * the same copy. What changes hour to hour is different: the last portion of
 * ต้มยำกุ้ง sold, coffee went up five baht, the croissant promotion ends today.
 * Waiting for a deploy to say "หมดแล้ว" means selling food that does not exist.
 *
 * So staff edits are kept as a thin layer of overrides keyed by SKU, and every
 * screen reads catalogue-plus-overrides instead of the catalogue. Only the
 * fields below can be overridden; a price edit cannot rewrite a dish's
 * allergens, which is exactly the field nobody should be able to change in a
 * hurry.
 */

const KEY = 'imjai-menu-overrides';

export type MenuOverride = {
  price?: number;
  stock?: number;
  available?: boolean;
  promotion?: string | null;
};

export type MenuOverrides = Record<string, MenuOverride>;

let cache: MenuOverrides = {};
let items: MenuItem[] = MENU_ITEMS;
let loaded = false;
const listeners = new Set<() => void>();

/** Reject anything that would put a nonsense figure in front of a customer. */
function clean(raw: unknown): MenuOverride | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as MenuOverride;
  const next: MenuOverride = {};
  if (typeof value.price === 'number' && Number.isFinite(value.price) && value.price >= 0) {
    next.price = Math.round(value.price);
  }
  if (typeof value.stock === 'number' && Number.isFinite(value.stock) && value.stock >= 0) {
    next.stock = Math.round(value.stock);
  }
  if (typeof value.available === 'boolean') next.available = value.available;
  if (typeof value.promotion === 'string' || value.promotion === null) {
    next.promotion = value.promotion ? value.promotion.slice(0, 120) : null;
  }
  return Object.keys(next).length ? next : null;
}

/**
 * Fold the overrides into the catalogue.
 *
 * Selling out is derived, not stored: staff set the stock number and
 * availability follows, so the two can never contradict each other on screen.
 */
export function applyOverrides(base: MenuItem[], overrides: MenuOverrides): MenuItem[] {
  return base.map((item) => {
    const override = overrides[item.sku];
    if (!override) return item;
    const stock = override.stock ?? item.stock;
    const available = (override.available ?? item.available) && stock > 0;
    return {
      ...item,
      price: override.price ?? item.price,
      stock,
      available,
      promotion: override.promotion === undefined ? item.promotion : override.promotion ?? undefined,
    };
  });
}

function readStored(): MenuOverrides {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    const next: MenuOverrides = {};
    for (const [sku, value] of Object.entries(raw)) {
      const override = clean(value);
      if (override) next[sku] = override;
    }
    return next;
  } catch {
    return {};
  }
}

function commit(overrides: MenuOverrides) {
  cache = overrides;
  items = applyOverrides(MENU_ITEMS, overrides);
  try {
    localStorage.setItem(KEY, JSON.stringify(overrides));
  } catch {
    // Nothing to do; the edit still applies to this tab.
  }
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);

  if (!loaded) {
    loaded = true;
    cache = readStored();
    items = applyOverrides(MENU_ITEMS, cache);
    window.addEventListener('storage', (event) => {
      if (event.key && event.key !== KEY) return;
      cache = readStored();
      items = applyOverrides(MENU_ITEMS, cache);
      for (const listener of listeners) listener();
    });
  }

  return () => {
    listeners.delete(onChange);
  };
}

const snapshot = () => items;
const serverSnapshot = () => MENU_ITEMS;

/** The menu as it stands right now, staff edits included. */
export function useMenu(): MenuItem[] {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Read once without subscribing — for the assistant answering a question. */
export function readMenu(): MenuItem[] {
  return loaded ? items : applyOverrides(MENU_ITEMS, {});
}

export function useMenuItem(sku: string | null | undefined): MenuItem | null {
  const menu = useMenu();
  return sku ? menu.find((item) => item.sku === sku) ?? null : null;
}

export function updateMenuItem(sku: string, change: MenuOverride) {
  const base = MENU_ITEMS.find((item) => item.sku === sku);
  if (!base) return;
  const merged = clean({ ...cache[sku], ...change });
  const next = { ...cache };
  if (merged) next[sku] = merged;
  else delete next[sku];
  commit(next);
}

/** Put one dish back to what the build shipped. */
export function resetMenuItem(sku: string) {
  const next = { ...cache };
  delete next[sku];
  commit(next);
}

export function resetAllMenuItems() {
  commit({});
}

/** True when this dish is showing something other than the printed menu. */
export function isEdited(sku: string, overrides: MenuOverrides = cache) {
  return Boolean(overrides[sku]);
}

export function readOverrides(): MenuOverrides {
  return cache;
}
