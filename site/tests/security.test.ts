import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('security guardrails', () => {
  it('does not put service-role or AI secrets in browser source', () => {
    const files = ['components/checkout-page.tsx','components/account-page.tsx','lib/supabase.ts'];
    const source = files.map((file) => fs.readFileSync(path.resolve(file),'utf8')).join('\n');
    expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY/);
  });
  it('keeps admin role changes outside the client', () => {
    const source = fs.readFileSync(path.resolve('components/admin-dashboard.tsx'),'utf8');
    expect(source).not.toMatch(/update\s*\(\s*\{\s*role/i);
  });
  it('requires verified Supabase sessions on money-changing functions', () => {
    const config = fs.readFileSync(path.resolve('supabase/config.toml'),'utf8');
    expect(config.match(/verify_jwt = true/g)).toHaveLength(3);

    const createOrder = fs.readFileSync(path.resolve('supabase/functions/create-order/index.ts'),'utf8');
    const verifySlip = fs.readFileSync(path.resolve('supabase/functions/verify-slip/index.ts'),'utf8');
    expect(createOrder).toContain("client.auth.getUser(authorization.slice(7))");
    expect(createOrder).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(verifySlip).toContain("authClient.auth.getUser(authorization.slice(7))");
    expect(verifySlip).toContain("order.user_id !== account.user.id");
    expect(verifySlip).toContain('verification_attempted_at.lt.${claimCutoff}');
  });
  it('keeps QR totals, original slips and staff changes in the database', () => {
    const sql = fs.readFileSync(path.resolve('supabase/ci/003_secure_order_flow.sql'),'utf8');
    expect(sql).toContain("if v_user is null then raise exception 'authentication required'");
    expect(sql).toContain('payable_amount');
    expect(sql).toContain('staff_set_order_status');
    expect(sql).toContain('staff_set_payment_status');
    expect(sql).toContain('supabase_realtime add table public.orders');

    const checkout = fs.readFileSync(path.resolve('components/checkout-page.tsx'),'utf8');
    expect(checkout).toContain("storage.from('payment-slips').upload");
    expect(checkout).toContain("setServerQuote(quote)");
    expect(checkout).toContain('data.payableAmount');
    expect(checkout).not.toContain(' disabled={Boolean(serverQuote)}');
    expect(checkout).toContain('readOnly={Boolean(serverQuote)}');
  });
  it('links LINE through one-time nonces and a narrow n8n bridge', () => {
    const sql = fs.readFileSync(path.resolve('supabase/ci/004_line_account_linking.sql'),'utf8');
    const bridge = fs.readFileSync(path.resolve('supabase/functions/line-orders/index.ts'),'utf8');
    const config = fs.readFileSync(path.resolve('supabase/config.toml'),'utf8');

    expect(sql).toContain("encode(digest(v_nonce,'sha256'),'hex')");
    expect(sql).toContain("now()+interval '10 minutes'");
    expect(sql).toContain("auth.role() <> 'service_role'");
    expect(sql).toContain('line account already linked');
    expect(sql).toContain('unlink_line_account');
    expect(sql).toContain('revoke all on table public.line_link_nonces from anon, authenticated');
    expect(bridge).toContain("request.headers.get('x-n8n-secret')");
    expect(bridge).toContain(".eq('user_id', link.user_id)");
    expect(bridge).not.toMatch(/customer_phone|delivery_address/);
    expect(config).toMatch(/\[functions\.line-orders\]\s+verify_jwt = false/);
  });
});
