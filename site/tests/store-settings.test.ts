import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * What the shop saved has to win over what the build shipped — but only where
 * they actually typed something. A blank field must not wipe out the fallback.
 */
async function boot(options: {
  configured: boolean;
  row?: Record<string, string | null> | null;
  buildId?: string;
  /** Rows the update returns: none is what a blocked write looks like. */
  rowsBack?: { id: boolean }[];
  /** What Supabase says when the table is missing from its schema cache. */
  readError?: { message: string } | null;
}) {
  const { configured, row = null, buildId = '', rowsBack = [{ id: true }], readError = null } = options;
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_LINE_OA_ID', buildId);
  vi.stubEnv('NEXT_PUBLIC_LINE_OA_LINK', '');

  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      // What Postgres returns for an update row-level security allowed.
      select: vi.fn().mockResolvedValue({ data: rowsBack, error: null }),
    }),
  });
  vi.doMock('../lib/supabase', () => ({
    isSupabaseConfigured: configured,
    supabase: configured
      ? {
          from: () => ({
            select: () => ({ maybeSingle: async () => ({ data: row, error: readError }) }),
            update,
          }),
        }
      : null,
  }));

  const mod = await import('../lib/store-settings');
  return { mod, view: renderHook(() => mod.useStoreSettings()), update };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('../lib/supabase');
});

describe('shop settings', () => {
  it('falls back to the build with no database at all', async () => {
    const { view } = await boot({ configured: false, buildId: '@frombuild' });
    expect(view.result.current.lineOaId).toBe('@frombuild');
  });

  it('takes what the shop saved over what the build shipped', async () => {
    const { view } = await boot({
      configured: true,
      buildId: '@frombuild',
      row: { line_oa_id: '@fromshop', line_oa_link: null, phone: null, address: null, hours: null },
    });
    await waitFor(() => expect(view.result.current.lineOaId).toBe('@fromshop'));
  });

  it('keeps the build value where the shop left the field empty', async () => {
    const { view } = await boot({
      configured: true,
      buildId: '@frombuild',
      row: { line_oa_id: '   ', line_oa_link: null, phone: '02-000-0000', address: null, hours: null },
    });
    await waitFor(() => expect(view.result.current.phone).toBe('02-000-0000'));
    expect(view.result.current.lineOaId).toBe('@frombuild');
  });

  it('writes blanks as null rather than empty strings', async () => {
    const { mod, update } = await boot({ configured: true });
    await mod.saveStoreSettings({ lineOaId: '  @imjai  ', phone: '   ' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ line_oa_id: '@imjai', phone: null }),
    );
  });

  it('reports there is nowhere to save rather than pretending', async () => {
    const { mod } = await boot({ configured: false });
    expect(await mod.saveStoreSettings({ lineOaId: '@imjai' })).toBe('no-database');
  });

  it('says saved when the row comes back', async () => {
    const { mod } = await boot({ configured: true });
    expect(await mod.saveStoreSettings({ phone: '02-000-0000' })).toBe('saved');
  });

  // The bug this exists for: Postgres answers an update that row-level
  // security filtered out with no error and no rows. Read as success, it told
  // the shop their phone number was saved while nothing had changed.
  it('does not call a write the database refused a success', async () => {
    const { mod } = await boot({ configured: true, rowsBack: [] });
    expect(await mod.saveStoreSettings({ phone: '02-000-0000' })).toBe('not-allowed');
  });
});

describe('where the settings on screen came from', () => {
  it('says live once the row has been read', async () => {
    const { mod } = await boot({
      configured: true,
      row: { line_oa_id: '@shop', line_oa_link: null, phone: null, address: null, hours: null, updated_at: '2026-08-23T09:00:00Z' },
    });
    const { renderHook: rh, waitFor: wf } = await import('@testing-library/react');
    const view = rh(() => mod.useSettingsSource());
    await wf(() => expect(view.result.current.state).toBe('live'));
    expect(view.result.current.updatedAt).toBe('2026-08-23T09:00:00Z');
  });

  // The failure that looked like an empty row: a table PostgREST has not
  // picked up yet is invisible to the API, and swallowing that made a broken
  // connection and a blank shop address indistinguishable.
  it('names a read that failed instead of quietly keeping the build values', async () => {
    const { mod } = await boot({
      configured: true,
      readError: { message: "Could not find the table 'public.store_settings' in the schema cache" },
    });
    const { renderHook: rh, waitFor: wf } = await import('@testing-library/react');
    const view = rh(() => mod.useSettingsSource());
    await wf(() => expect(view.result.current.state).toBe('error'));
    expect(view.result.current.error).toContain('schema cache');
  });

  it('says so when there is no database behind it at all', async () => {
    const { mod } = await boot({ configured: false });
    const { renderHook: rh, waitFor: wf } = await import('@testing-library/react');
    const view = rh(() => mod.useSettingsSource());
    await wf(() => expect(view.result.current.state).toBe('build-only'));
  });
});
