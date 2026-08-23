'use client';

import { useSyncExternalStore } from 'react';

/**
 * One-line confirmations that do not interrupt the tap that caused them.
 *
 * Lives outside React, the same shape as `lib/orders.ts` — the thing that
 * raises a toast (adding a dish from the home grid, a menu card, or the AI
 * assistant; a failed checkout submit) is rarely the component that should
 * own how long it stays on screen. Auto-dismiss lives here once instead of
 * once per caller.
 */

export type ToastTone = 'success' | 'info' | 'error';

export type Toast = { id: number; text: string; tone: ToastTone };

const DEFAULT_MS = 3200;

let toasts: Toast[] = [];
let nextId = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, number>();

function announce() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

const snapshot = () => toasts;
const EMPTY: Toast[] = [];
const serverSnapshot = () => EMPTY;

/** Live list, newest last. Empty while server-rendering. */
export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function dismissToast(id: number) {
  const timer = timers.get(id);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timers.delete(id);
  }
  toasts = toasts.filter((toast) => toast.id !== id);
  announce();
}

export function showToast(text: string, tone: ToastTone = 'success', ms = DEFAULT_MS): number {
  const id = (nextId += 1);
  toasts = [...toasts, { id, text, tone }];
  announce();
  timers.set(id, window.setTimeout(() => dismissToast(id), ms));
  return id;
}
