import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      include: ['app/**', 'components/**', 'lib/**'],
      // Les pages sont des composants serveur : elles sont couvertes par les
      // tests de bout en bout, pas ici.
      exclude: ['**/layout.tsx', '**/page.tsx', '**/error.tsx'],
    },
  },
});
