import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StoredOrder } from '../lib/orders';

const QUEUE_KEY = 'imjai-n8n-queue';
const URL = 'https://n8n.example.com/webhook/imjai';

const order = (over: Partial<StoredOrder> = {}): StoredOrder => ({
  orderNumber: 'IMJ-0001',
  idempotencyKey: 'key-1',
  name: 'ลูกค้า',
  phone: '0800000000',
  fulfilment: 'pickup',
  payment: 'promptpay',
  lines: [
    { id: 'l1', sku: 'latte', name: 'ลาเต้', emoji: '☕', quantity: 2, unitPrice: 75, options: ['หวานน้อย'], addOns: [{ name: 'ช็อตพิเศษ', price: 15 }] },
  ] as StoredOrder['lines'],
  totals: { subtotal: 180, discount: 0, deliveryFee: 0, total: 180 },
  payableAmount: 180.17,
  slipReference: 'ref-9',
  paymentNote: null,
  status: 'pending',
  paymentStatus: 'pending_verification',
  createdAt: '2026-08-22T10:00:00.000Z',
  accountEmail: 'a@b.co',
  ...over,
});

async function load(configured = true) {
  localStorage.clear();
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_N8N_WEBHOOK_URL', configured ? URL : '');
  return import('../lib/n8n');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const queued = () => JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');

describe('forwarding an order to n8n', () => {
  it('sends nothing at all when no webhook is configured', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const n8n = await load(false);

    await n8n.notify('order.placed', order());

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(queued()).toEqual([]);
  });

  it('posts only a wake signal and order reference', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
    const n8n = await load();

    await n8n.notify('order.placed', order());

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(URL);
    expect(init.headers).toEqual({ 'Content-Type': 'text/plain;charset=UTF-8' });
    const body = JSON.parse(init.body);
    expect(body.event).toBe('order.placed');
    expect(body.order.orderNumber).toBe('IMJ-0001');
    expect(body.order).toEqual({ orderNumber: 'IMJ-0001' });
    expect(init.mode).toBe('no-cors');
    expect(queued()).toEqual([]);
  });

  it('accepts the opaque response returned by a no-cors webhook', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, type: 'opaque' }));
    const n8n = await load();

    await n8n.notify('order.placed', order());

    expect(queued()).toEqual([]);
  });

  // The point of this channel is that the shop learns a customer is waiting.
  // A dropped send is a customer nobody is cooking for.
  it('keeps a failed send instead of dropping it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const n8n = await load();

    await n8n.notify('order.placed', order());

    expect(queued()).toHaveLength(1);
    expect(queued()[0].order.orderNumber).toBe('IMJ-0001');
  });

  it('sends what was waiting once the network comes back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    let n8n = await load();
    await n8n.notify('order.placed', order());
    expect(queued()).toHaveLength(1);

    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_N8N_WEBHOOK_URL', URL);
    n8n = await import('../lib/n8n');

    await n8n.flushQueue();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(queued()).toEqual([]);
  });

  it('gives up on a send that keeps failing rather than retrying forever', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const n8n = await load();

    await n8n.notify('order.placed', order());
    for (let attempt = 0; attempt < 8; attempt += 1) await n8n.flushQueue();

    expect(queued()).toEqual([]);
  });

  it('treats a rejecting webhook as a failure, not a success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const n8n = await load();

    await n8n.notify('order.placed', order());

    expect(queued()).toHaveLength(1);
  });
});
