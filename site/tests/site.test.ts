import { describe, expect, it } from 'vitest';
import { SITE_URL, safeNextPath } from '../lib/site';

describe('the site origin used in outbound links', () => {
  it('is an absolute URL, not just a bare domain', () => {
    // GitHub Pages serves this repo at a subpath; a redirect built without it
    // 404s even though the domain is correct.
    expect(SITE_URL).toMatch(/^https:\/\/.+\/.+/);
    expect(SITE_URL.endsWith('/')).toBe(false);
  });
});

describe('the path handed back after a confirmation email or LINE', () => {
  it('carries forward where the visitor was headed', () => {
    expect(safeNextPath('/account/link-line/?linkToken=abc')).toBe('/account/link-line/?linkToken=abc');
  });

  it('defaults to home with nothing to return to', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath('')).toBe('/');
  });

  it('refuses to leave the site', () => {
    // Starts with "/" like a real path would, but a browser resolves it as
    // scheme-relative — "//evil.example/x" — and leaves chonlasapmatt-art.github.io entirely.
    expect(safeNextPath('//evil.example/phish')).toBe('/');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('not-a-path')).toBe('/');
  });
});
