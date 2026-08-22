import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'imjai-session';

type Account = { id: string; email: string; user_metadata?: Record<string, unknown> };

/**
 * Boot the session store fresh, with Supabase either wired up or absent.
 *
 * The store hydrates once per module instance, so each case needs its own —
 * hence resetModules and a dynamic import rather than a top-level one.
 */
async function boot(options: {
  stored?: unknown;
  configured: boolean;
  account?: Account | null;
  failing?: boolean;
  role?: string;
}) {
  const { stored, configured, account = null, failing = false, role = 'customer' } = options;

  localStorage.clear();
  if (stored) localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

  vi.resetModules();
  vi.doMock('../lib/supabase', () => ({
    isSupabaseConfigured: configured,
    supabase: configured
      ? {
          auth: {
            getUser: failing
              ? vi.fn().mockRejectedValue(new Error('offline'))
              : vi.fn().mockResolvedValue({ data: { user: account } }),
            onAuthStateChange: vi.fn(),
            signOut: vi.fn().mockResolvedValue({}),
          },
          from: () => ({
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role } }) }) }),
          }),
        }
      : null,
  }));

  const mod = await import('../lib/session');
  const view = renderHook(() => mod.useSession());
  return { mod, view };
}

const PREVIEW_USER = { email: 'shop@imjai.test', name: 'shop', verified: false };
const REAL_USER = { email: 'shop@imjai.test', name: 'shop', verified: true };

afterEach(() => {
  vi.doUnmock('../lib/supabase');
  localStorage.clear();
});

describe('a session left over from preview mode', () => {
  it('still signs the shop in while there is no Supabase project', async () => {
    const { view } = await boot({ stored: PREVIEW_USER, configured: false });
    await waitFor(() => expect(view.result.current.status).toBe('signed-in'));
    expect(view.result.current.user?.verified).toBe(false);
  });

  // The regression: once Supabase is configured, the stored preview user was
  // still being restored as a signed-in session. The shop saw its own name and
  // a "preview" badge on the live site while being, to the database, a
  // stranger — which is why promoting that address to admin matched no rows.
  it('is discarded once Supabase is configured', async () => {
    const { view } = await boot({ stored: PREVIEW_USER, configured: true });
    // Asserted on the very first render, before any request comes back:
    // Supabase signing us out a moment later is not good enough, because the
    // gap is long enough to show the shop a signed-in page it cannot use.
    expect(view.result.current.status).toBe('signed-out');
    expect(view.result.current.user).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('a stored session on a configured build', () => {
  it('is signed out when Supabase cannot be reached', async () => {
    const { view } = await boot({ stored: REAL_USER, configured: true, failing: true });
    await waitFor(() => expect(view.result.current.status).toBe('signed-out'));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('is signed out when Supabase has no account for it', async () => {
    const { view } = await boot({ stored: REAL_USER, configured: true, account: null });
    await waitFor(() => expect(view.result.current.status).toBe('signed-out'));
  });

  it('takes the role from the database, not from storage', async () => {
    const { view } = await boot({
      stored: REAL_USER,
      configured: true,
      account: { id: 'uid-1', email: 'shop@imjai.test' },
      role: 'admin',
    });
    await waitFor(() => expect(view.result.current.role).toBe('admin'));
    expect(view.result.current.user?.verified).toBe(true);
  });

  it('stays a customer when the profile says nothing useful', async () => {
    const { view } = await boot({
      stored: REAL_USER,
      configured: true,
      account: { id: 'uid-2', email: 'someone@example.com' },
      role: 'customer',
    });
    await waitFor(() => expect(view.result.current.status).toBe('signed-in'));
    expect(view.result.current.role).toBe('customer');
  });
});
