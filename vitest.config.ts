import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@minecraft/server': path.resolve(__dirname, 'scripts/__mocks__/@minecraft/server.ts'),
      '@minecraft/server-ui': path.resolve(__dirname, 'scripts/__mocks__/@minecraft/server-ui.ts'),
      '@minecraft/server-gametest': path.resolve(__dirname, 'scripts/__mocks__/@minecraft/server-gametest.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['scripts/**/*.ts'],
      exclude: ['scripts/**/*.test.ts'],
    },
  },
});
