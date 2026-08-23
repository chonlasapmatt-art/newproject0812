'use client';

import { useSyncExternalStore } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';

/**
 * The shop's own details, changed by the shop.
 *
 * The LINE account and the phone number are not code, but they were build
 * settings — so every correction meant asking us and waiting for a deploy.
 * They live in the database now, and the dashboard edits them.
 *
 * Three sources, in order: what the shop typed, then the build setting, then
 * the placeholder that ships with the site. That order is what lets the button
 * work the moment the id is saved, while a site with no database at all still
 * behaves exactly as it did.
 */

export type StoreSettings = {
  lineOaId: string;
  lineOaLink: string;
  phone: string;
  address: string;
  hours: string;
};

/**
 * What the database actually holds, as opposed to what the form is showing.
 *
 * The shop was told a save succeeded while nothing had changed, and had no way
 * to tell the difference. So the row is reported separately from the merged
 * settings: `loadedAt` proves a read happened, `updatedAt` is the database's
 * own record of the last write, and `error` is why there is neither.
 */
export type SettingsSource = {
  state: 'loading' | 'live' | 'build-only' | 'error';
  updatedAt: string | null;
  error: string | null;
};

/** What the build was given, used until the database says otherwise. */
const FROM_BUILD: StoreSettings = {
  lineOaId: (process.env.NEXT_PUBLIC_LINE_OA_ID ?? '').trim(),
  lineOaLink: (process.env.NEXT_PUBLIC_LINE_OA_LINK ?? '').trim(),
  phone: '',
  address: '',
  hours: '',
};

let current: StoreSettings = FROM_BUILD;
let source: SettingsSource = { state: 'loading', updatedAt: null, error: null };
let loaded = false;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

/** A database row only wins where it actually has something to say. */
function merge(row: Record<string, string | null> | null): StoreSettings {
  if (!row) return FROM_BUILD;
  const pick = (value: string | null | undefined, fallback: string) => {
    const trimmed = (value ?? '').trim();
    return trimmed || fallback;
  };
  return {
    lineOaId: pick(row.line_oa_id, FROM_BUILD.lineOaId),
    lineOaLink: pick(row.line_oa_link, FROM_BUILD.lineOaLink),
    phone: pick(row.phone, FROM_BUILD.phone),
    address: pick(row.address, FROM_BUILD.address),
    hours: pick(row.hours, FROM_BUILD.hours),
  };
}

async function load() {
  if (!isSupabaseConfigured || !supabase) {
    source = { state: 'build-only', updatedAt: null, error: null };
    announce();
    return;
  }
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('line_oa_id, line_oa_link, phone, address, hours, updated_at')
      .maybeSingle();
    if (error) {
      // Named rather than swallowed: "could not find the table in the schema
      // cache" is a different problem from a row that is simply empty, and
      // silently keeping the build values made the two look identical.
      source = { state: 'error', updatedAt: null, error: error.message };
      announce();
      return;
    }
    const row = data as (Record<string, string | null> & { updated_at?: string }) | null;
    current = merge(row);
    source = { state: 'live', updatedAt: row?.updated_at ?? null, error: null };
    announce();
  } catch (thrown) {
    source = {
      state: 'error',
      updatedAt: null,
      error: thrown instanceof Error ? thrown.message : 'unknown error',
    };
    announce();
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!loaded) {
    loaded = true;
    void load();
  }
  return () => {
    listeners.delete(onChange);
  };
}

const snapshot = () => current;
/** The server renders the build's answer; the browser corrects it on load. */
const serverSnapshot = () => FROM_BUILD;

export function useStoreSettings(): StoreSettings {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

const LOADING: SettingsSource = { state: 'loading', updatedAt: null, error: null };
const sourceSnapshot = () => source;

/** Where the settings on screen came from. For the dashboard, not the site. */
export function useSettingsSource(): SettingsSource {
  return useSyncExternalStore(subscribe, sourceSnapshot, () => LOADING);
}

/**
 * What happened when the shop pressed save.
 *
 * More than a boolean because the two ways this fails need different answers.
 * A blocked write means the account is not staff and the fix is to be promoted;
 * a failed one means the request did not land and the fix is to try again.
 */
export type SaveResult = 'saved' | 'not-allowed' | 'no-database' | 'failed';

/**
 * Save from the dashboard. Row-level security is what decides if it lands.
 *
 * The row is asked for back. Postgres answers an update that row-level
 * security filtered out with no error and no rows — so without this, a write
 * the database refused reported success, and the shop was told their phone
 * number was saved when nothing had changed.
 */
export async function saveStoreSettings(next: Partial<StoreSettings>): Promise<SaveResult> {
  if (!isSupabaseConfigured || !supabase) return 'no-database';
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .update({
        line_oa_id: next.lineOaId?.trim() || null,
        line_oa_link: next.lineOaLink?.trim() || null,
        phone: next.phone?.trim() || null,
        address: next.address?.trim() || null,
        hours: next.hours?.trim() || null,
      })
      .eq('id', true)
      .select('id');

    if (error) return 'failed';
    if (!data || data.length === 0) return 'not-allowed';

    // Read back rather than trusting the local merge: what the shop sees after
    // saving should be what the database actually holds, including anything a
    // trigger changed on the way in.
    await load();
    return 'saved';
  } catch {
    return 'failed';
  }
}
