import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'https://ritoswap.io'
      }
    },
    setupFiles: ['./tests/setupTests.ts'],
    css: {
      modules: {
        classNameStrategy: 'non-scoped'
      }
    },
    // Default jsdom origin prevents cross-origin pushState errors
    env: {
      NODE_ENV: 'test'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@components': path.resolve(__dirname, './app/components'),
      '@Contexts': path.resolve(__dirname, './app/contexts'),
      '@Stores': path.resolve(__dirname, './app/stores'),
      '@lib': path.resolve(__dirname, './lib'),
      '@snippets': path.resolve(__dirname, './app/components/_includes')
    }
  }
})
