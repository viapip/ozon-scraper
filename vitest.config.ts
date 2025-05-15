import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
      '~/*': resolve(__dirname, './src/*'),
    },
  },
  test: {
    coverage: {
      exclude: ['**/*.d.ts', '**/types/**'],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: [
        'text',
        'json',
        'html',
      ],
    },
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: true,
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
})
