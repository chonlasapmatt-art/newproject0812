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
});
