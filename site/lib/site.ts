// The absolute origin+path this site is actually served from. GitHub Pages
// serves this repository at a subpath, not the domain root, so a redirect
// built from location.origin alone — the only option once the browser is
// about to leave the page entirely, as Supabase's emailRedirectTo/redirectTo
// require — drops that subpath and 404s. Same fallback app/layout.tsx,
// sitemap.ts and robots.ts already use.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chonlasapmatt-art.github.io/newproject0812';

/** A same-site path safe to hand back after a trip through an external
 * redirect (a confirmation email, LINE). Rejects anything that is not a
 * same-origin path — including a protocol-relative "//host", which starts
 * with "/" but would leave the site — so this can only send someone back
 * into the app, never off it. No pending destination becomes home, not
 * wherever the caller happened to be. */
export function safeNextPath(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
