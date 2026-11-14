import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['scripts/**/*.test.ts','site/**/*.test.ts','play/**/*.test.ts','convex/**/*.test.ts'], testTimeout: 15000 } });
