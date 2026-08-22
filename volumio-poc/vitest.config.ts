import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  resolve: {
    alias: {
      '$lib': path.resolve('./src/lib')
    },
    // Ensure browser conditions for Svelte 5
    conditions: ['browser']
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest-setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    // For Svelte 5 component testing
    alias: {
      // Force browser bundle
      'svelte': 'svelte'
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'vitest-setup.ts']
    }
  }
});
