import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(env: Record<string, string>) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_LINE_OA_ID', env.id ?? '');
  vi.stubEnv('NEXT_PUBLIC_LINE_OA_LINK', env.link ?? '');
  return import('../lib/line-oa');
}

afterEach(() => vi.unstubAllEnvs());

describe('the shop LINE account', () => {
  it('is off until an id is given, so no button opens an empty chat', async () => {
    const line = await load({});
    expect(line.isLineConfigured).toBe(false);
    expect(line.lineChatUrl()).toBe('');
  });

  it('accepts the id with or without the @ the shop happens to type', async () => {
    expect((await load({ id: 'imjaicafe' })).lineBasicId).toBe('@imjaicafe');
    expect((await load({ id: '@imjaicafe' })).lineBasicId).toBe('@imjaicafe');
  });

  it('builds an add-friend link that works for new and existing followers', async () => {
    const line = await load({ id: '@imjaicafe' });
    expect(line.lineChatUrl()).toBe('https://line.me/R/ti/p/%40imjaicafe');
  });

  it('uses a lin.ee short link as given when the shop has one', async () => {
    const line = await load({ id: '@ignored', link: 'https://lin.ee/AbCdEf' });
    expect(line.lineChatUrl()).toBe('https://lin.ee/AbCdEf');
  });

  it('tells the customer to quote the order number when there is one', async () => {
    const line = await load({ id: '@imjaicafe' });
    expect(line.lineHintFor({ kind: 'order', orderNumber: 'IMJ-0042' })).toContain('IMJ-0042');
    expect(line.lineHintFor({ kind: 'general' })).not.toContain('IMJ-');
  });
});
