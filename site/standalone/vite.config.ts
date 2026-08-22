import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Builds the whole site into one self-contained HTML file.
 *
 * The app normally renders through the Next app router on a server. Here the
 * `next/*` imports resolve to the hash-router shims in ./shims, so every page
 * component compiles unchanged and the result runs from a static file with no
 * server, no routing rules and no network requests beyond the webfont.
 */

const shim = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: shim('.'),
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: {
    alias: {
      'next/link': shim('./shims/link.tsx'),
      'next/navigation': shim('./shims/navigation.ts'),
    },
  },
  define: {
    // Inlined at build time, exactly as the Next build does for NEXT_PUBLIC_*.
    'process.env.NEXT_PUBLIC_PROMPTPAY_ID': JSON.stringify(process.env.NEXT_PUBLIC_PROMPTPAY_ID ?? ''),
    'process.env.NEXT_PUBLIC_PROMPTPAY_NAME': JSON.stringify(process.env.NEXT_PUBLIC_PROMPTPAY_NAME ?? ''),
    'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(''),
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(''),
    'process.env.NEXT_PUBLIC_ADMIN_PREVIEW_MODE': JSON.stringify('false'),
    // Any NEXT_PUBLIC_* the code reads has to appear here. One left out stays
    // in the bundle as a literal `process.env.X`, and `process` does not exist
    // in a browser — the page would die on the first render rather than fall
    // back to the empty default the code was written to expect.
    'process.env.NEXT_PUBLIC_ADMIN_EMAILS': JSON.stringify(process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? ''),
    'process.env.NEXT_PUBLIC_SITE_URL': JSON.stringify(process.env.NEXT_PUBLIC_SITE_URL ?? ''),
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: shim('../dist-standalone'),
    emptyOutDir: true,
    // One file means one chunk; the inliner needs everything in the entry.
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 8_000,
  },
});
