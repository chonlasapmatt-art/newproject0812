import { supabase } from './supabase';

const LINE_ACCOUNT_LINK_ENDPOINT = 'https://access.line.me/dialog/bot/accountLink';

/** LINE link tokens are opaque URL-safe values. Reject control characters and
 * oversized input before reflecting one into the external redirect. */
export function validLineLinkToken(value: string | null | undefined): value is string {
  return Boolean(value && value.length >= 20 && value.length <= 500 && /^[A-Za-z0-9._~-]+$/.test(value));
}

export function lineAccountLinkUrl(linkToken: string, nonce: string): string {
  if (!validLineLinkToken(linkToken) || !/^[0-9a-f]{64}$/.test(nonce)) {
    throw new Error('invalid_line_link');
  }
  const params = new URLSearchParams({ linkToken, nonce });
  return `${LINE_ACCOUNT_LINK_ENDPOINT}?${params.toString()}`;
}

export type LineAccountState = {
  linked: boolean;
  linkedAt: string | null;
};

export async function getLineAccountState(): Promise<LineAccountState> {
  if (!supabase) return { linked: false, linkedAt: null };
  const { data, error } = await supabase
    .from('line_accounts')
    .select('linked_at')
    .maybeSingle();
  if (error) throw error;
  return { linked: Boolean(data), linkedAt: data?.linked_at ?? null };
}

export async function beginLineAccountLink(linkToken: string): Promise<string> {
  if (!supabase) throw new Error('supabase_not_configured');
  const { data, error } = await supabase.rpc('create_line_link_nonce');
  if (error || typeof data !== 'string') throw error ?? new Error('nonce_not_created');
  return lineAccountLinkUrl(linkToken, data);
}

export async function unlinkLineAccount(): Promise<void> {
  if (!supabase) throw new Error('supabase_not_configured');
  const { error } = await supabase.rpc('unlink_line_account');
  if (error) throw error;
}
