import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    // Worker threads start faster than the default child processes
    pool: 'threads',
    include: ['src/**/*.test.ts', 'messages/**/*.test.ts'],
  },
})
