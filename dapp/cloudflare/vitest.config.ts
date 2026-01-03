import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    conditions: ['workerd', 'worker', 'browser', 'module', 'import'],
  },
});
