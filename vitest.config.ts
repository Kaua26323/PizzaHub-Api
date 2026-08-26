import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const srcDirectory = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': srcDirectory,
    },
  },

  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'smoke',
          environment: 'node',
          include: ['tests/smoke/**/*.test.ts'],
        },
      },

      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.spec.ts'],
        },
      },

      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/setup/integration.ts'],
          fileParallelism: false,
        },
      },

      {
        extends: true,
        test: {
          name: 'http',
          environment: 'node',
          include: ['tests/http/**/*.test.ts'],
          setupFiles: ['tests/setup/http.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
});
