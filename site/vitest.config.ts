import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'], exclude: ['e2e/**'], environment: 'jsdom', globals: true, setupFiles: ['./tests/setup.ts'], coverage: { reporter: ['text','json-summary'] } } });
