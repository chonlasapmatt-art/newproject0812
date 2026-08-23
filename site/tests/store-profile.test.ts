import { describe, expect, it } from 'vitest';
import { STORE } from '../lib/catalog';
import { CONTACT_CHANNELS, STORE_PROFILE } from '../lib/store-profile';

/**
 * The shop's details live in two places and are printed in a third.
 *
 * Correcting the address touched store-profile and left catalog behind, so
 * the contact page showed the new one while the home page kept the old — and
 * nothing failed, because each file was internally consistent. These check the
 * agreement between them, which is the thing that actually broke.
 */

const channel = (id: string) => CONTACT_CHANNELS.find((entry) => entry.id === id);

describe('the shop details agree with each other', () => {
  it('gives the same address wherever it is read from', () => {
    expect(STORE.address).toBe(STORE_PROFILE.location.address);
  });

  it('gives the same phone number on the contact card as everywhere else', () => {
    expect(channel('phone')?.value).toBe(STORE.phone);
  });

  it('dials the number it prints', () => {
    expect(channel('phone')?.href).toBe(`tel:${STORE.phone.replace(/\D/g, '')}`);
  });

  it('names the same LINE account in both places', () => {
    expect(channel('line')?.value).toBe(STORE.line);
  });
});

describe('nothing invented ships as if it were real', () => {
  // Each of these was on the live site while the shop believed it had been
  // corrected. Named individually so a failure says which one came back.
  const INVENTED = ['88/12', 'สุขุมวิท', '02-123-4567', 'imjaicafe', 'example.com'];

  it('keeps the placeholder shop details out of what customers read', () => {
    const printed = [
      STORE.address,
      STORE.phone,
      STORE.line,
      STORE_PROFILE.location.address,
      ...CONTACT_CHANNELS.flatMap((entry) => [entry.value, entry.href ?? '']),
    ].join(' ');

    for (const invented of INVENTED) {
      expect(printed, `"${invented}" is placeholder text and is still on the site`).not.toContain(invented);
    }
  });
});
