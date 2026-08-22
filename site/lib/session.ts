'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';

/**
 * Who is using the site, and what they are allowed to do.
 *
 * Browsing is open — a customer can read the whole menu and fill a basket
 * without an account, because a shop that demands a signup before showing its
 * food loses the customer who arrived from a LINE link. Signing in is asked
 * for once, at checkout, where it starts earning its keep: order history,
 * saved addresses, and a name to put on the order.
 *
 * Two roles sit above that. `customer` is anyone signed in. `admin` is an
 * address on the configured list — the shop's own people, who get the
 * dashboard and the order controls. The list is read at build time from
 * NEXT_PUBLIC_ADMIN_EMAILS, so the site can tell staff from customers before
 * a database exists to ask.
 */

export type Role = 'guest' | 'customer' | 'staff' | 'admin';

export type SessionUser = {
  email: string;
  name: string;
  /** True once Supabase has verified this session; false in preview mode. */
  verified: boolean;
};

export type Session = {
  /** `loading` only while Supabase is restoring a stored session. */
  status: 'loading' | 'signed-out' | 'signed-in';
  user: SessionUser | null;
  role: Role;
};

/** True when no Supabase project is wired up yet. */
export const isPreviewMode = !isSupabaseConfigured;

const STORAGE_KEY = 'imjai-session';

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

/** True when nobody has been named as staff for this build. */
export const isAdminListConfigured = ADMIN_EMAILS.length > 0;

/**
 * Preview access to the dashboard.
 *
 * Without Supabase there is no database, so every order and menu edit lives in
 * the browser that made it: the dashboard on a deployed preview shows the
 * viewer their own data and nobody else's. There is nothing to protect yet,
 * and no real authentication to protect it with — the email list is a build
 * setting, not a login.
 *
 * So while the site is in preview, the shop can let itself in with a click and
 * the lock screen says exactly what that means. The moment Supabase is
 * configured this stops working, because then there is real data behind the
 * door and row-level security is what decides who opens it.
 */
const PREVIEW_ADMIN_KEY = 'imjai-preview-admin';

function hasPreviewAdmin(): boolean {
  if (!isPreviewMode) return false;
  try {
    return localStorage.getItem(PREVIEW_ADMIN_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The role a browser can work out on its own.
 *
 * This is the answer before the database has one — the build-time list, or the
 * preview switch. Once Supabase is connected, `profiles.role` replaces it: see
 * `applyAccount` below. Nothing here can grant a role the server will honour;
 * row-level security decides what any of them can actually read.
 */
export function roleFor(email: string | null | undefined): Role {
  if (!email) return 'guest';
  if (ADMIN_EMAILS.includes(email.trim().toLowerCase())) return 'admin';
  return hasPreviewAdmin() ? 'admin' : 'customer';
}

/** Only these two open the dashboard. `customer` never does. */
const BACK_OF_HOUSE: Role[] = ['staff', 'admin'];

const SIGNED_OUT: Session = { status: 'signed-out', user: null, role: 'guest' };
const LOADING: Session = { status: 'loading', user: null, role: 'guest' };

/**
 * The session lives outside React.
 *
 * Both sources of truth are asynchronous — localStorage is only readable in the
 * browser, and Supabase answers over the network — so holding this in component
 * state would mean setting state from an effect on every mount. An external
 * store lets the server render the signed-out view and the client correct it.
 */
let current: Session = LOADING;
let hydrated = false;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

function setSession(next: Session) {
  current = next;
  announce();
}

function readStored(): Session {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SIGNED_OUT;
    const user = JSON.parse(raw) as SessionUser;
    if (!user?.email) return SIGNED_OUT;
    // A session made in preview mode must not survive into a build that has
    // Supabase. Nothing ever authenticated it, Supabase is about to contradict
    // it, and until that answer arrives the site would show a signed-in header
    // — and a "preview" badge — to somebody who is actually signed out.
    if (isSupabaseConfigured && !user.verified) {
      persist(null);
      return SIGNED_OUT;
    }
    return { status: 'signed-in', user, role: roleFor(user.email) };
  } catch {
    return SIGNED_OUT;
  }
}

function persist(user: SessionUser | null) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing refuses storage; the session simply lasts one page.
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);

  // First subscriber wakes the store up.
  if (!hydrated) {
    hydrated = true;
    setSession(readStored());

    if (isSupabaseConfigured && supabase) {
      // Supabase is the authority when it is configured: whatever it reports
      // replaces the locally remembered session, including signing us out.
      // A rejection here must sign out too. Without the catch, a network
      // failure leaves whatever was in storage standing as the session.
      supabase.auth.getUser()
        .then(({ data }) => applyAccount(data.user))
        .catch(() => applyAccount(null));
      supabase.auth.onAuthStateChange((_event, next) => applyAccount(next?.user ?? null));
    }
  }

  return () => {
    listeners.delete(onChange);
  };
}

/**
 * Turn a Supabase account into a session, role and all.
 *
 * The session is published twice on purpose. First immediately, so a signed-in
 * customer is not left looking at a signed-out header while a second request
 * is in flight; then again once `profiles.role` comes back, which is the only
 * answer that counts. The row is readable because RLS lets an account read its
 * own profile, and `role` is not writable from here at all — the migration
 * revokes that column from `authenticated`, so a browser cannot promote
 * itself no matter what it sends.
 */
async function applyAccount(account: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null) {
  if (!account?.email || !supabase) {
    persist(null);
    setSession(SIGNED_OUT);
    return;
  }

  const user: SessionUser = {
    email: account.email,
    name: (account.user_metadata?.full_name as string) || account.email.split('@')[0],
    verified: true,
  };
  persist(user);
  setSession({ status: 'signed-in', user, role: 'customer' });

  try {
    const { data } = await supabase.from('profiles').select('role').eq('id', account.id).maybeSingle();
    const stored = data?.role as Role | undefined;
    setSession({
      status: 'signed-in',
      user,
      role: stored && BACK_OF_HOUSE.includes(stored) ? stored : 'customer',
    });
  } catch {
    // The profile could not be read — stay a customer rather than guess
    // upward. A shop locked out of its own dashboard is recoverable; a
    // stranger let into it is not.
  }
}

const snapshot = () => current;
const serverSnapshot = () => SIGNED_OUT;

export function useSession(): Session {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Convenience for the many places that only care about one capability. */
export function useCan() {
  const { role, status } = useSession();
  return {
    role,
    isAdmin: BACK_OF_HOUSE.includes(role),
    isSignedIn: status === 'signed-in',
    /** Placing an order is the one action that needs an account. */
    canOrder: status === 'signed-in',
    canSeeDashboard: BACK_OF_HOUSE.includes(role),
  };
}

/**
 * Turn preview access on or off.
 *
 * Refused outright when Supabase is configured: at that point the dashboard
 * shows the shop's real orders and a switch in the browser must not be able
 * to open it.
 */
export function setPreviewAdmin(on: boolean) {
  if (!isPreviewMode) return;
  try {
    if (on) localStorage.setItem(PREVIEW_ADMIN_KEY, '1');
    else localStorage.removeItem(PREVIEW_ADMIN_KEY);
  } catch {
    return;
  }
  const user = current.user;
  if (user) setSession({ status: 'signed-in', user, role: roleFor(user.email) });
}

export function useSignOut() {
  return useCallback(async () => {
    if (isSupabaseConfigured && supabase) await supabase.auth.signOut();
    persist(null);
    setSession(SIGNED_OUT);
  }, []);
}

/**
 * Sign in without Supabase, for previewing the site before a project exists.
 *
 * The returned user is marked `verified: false` and nothing server-side will
 * accept it — every real check runs against Supabase. It exists so the shop
 * can walk through the whole flow, including the admin views, while the
 * backend is still being set up.
 */
export function previewSignIn(email: string, name?: string): Session {
  const user: SessionUser = {
    email,
    name: name?.trim() || email.split('@')[0],
    verified: false,
  };
  persist(user);
  const next: Session = { status: 'signed-in', user, role: roleFor(email) };
  setSession(next);
  return next;
}

