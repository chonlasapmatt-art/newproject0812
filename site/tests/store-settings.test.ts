import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * What the shop saved has to win over what the build shipped — but only where
 * they actually typed something. A blank field must not wipe out the fallback.
 */
async function boot(options: { configured: boolean; row?: Record<string, string | null> | null; buildId?: string }) {
  const { configured, row = null, buildId = '' } = options;
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_LINE_OA_ID', buildId);
  vi.stubEnv('NEXT_PUBLIC_LINE_OA_LINK', '');

  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  vi.doMock('../lib/supabase', () => ({
    isSupabaseConfigured: configured,
    supabase: configured
      ? {
          from: () => ({
            select: () => ({ maybeSingle: async () => ({ data: row }) }),
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

  it('reports failure rather than pretending to save with no database', async () => {
    const { mod } = await boot({ configured: false });
    expect(await mod.saveStoreSettings({ lineOaId: '@imjai' })).toBe(false);
  });
});
