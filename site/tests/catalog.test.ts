import { describe, expect, it } from 'vitest';
import { MENU_ITEMS, optionPriceDelta } from '../lib/catalog';

describe('optionPriceDelta', () => {
  it('reads the surcharge the shop wrote into a variant label', () => {
    expect(optionPriceDelta('ใหญ่ +15')).toBe(15);
  });

  it('is zero for a variant with no surcharge in its label', () => {
    expect(optionPriceDelta('ปกติ')).toBe(0);
    expect(optionPriceDelta('เย็น')).toBe(0);
    expect(optionPriceDelta('เผ็ดมาก')).toBe(0);
  });

  it('reads a decimal surcharge, not just whole baht', () => {
    expect(optionPriceDelta('ไซซ์พิเศษ +12.50')).toBe(12.5);
  });

  /**
   * The database prices variants by matching this exact string as a name in
   * menu_item_variants (see supabase/ci/003_secure_order_flow.sql) — every
   * "+N" label actually on the menu has to parse to the same number the
   * server charges, or the two would quietly disagree again.
   */
  it('agrees with every "+N" variant label actually on the menu', () => {
    const priced = MENU_ITEMS.flatMap((item) => item.options ?? [])
      .flatMap((group) => group.values)
      .filter((value) => value.includes('+'));
    expect(priced).toContain('ใหญ่ +15');
    for (const value of priced) {
      expect(optionPriceDelta(value)).toBeGreaterThan(0);
    }
  });
});
