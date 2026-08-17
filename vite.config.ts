import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      input: {
        // Main popup entry (index.html)
        main: resolve(__dirname, 'index.html'),
      },
    },
    // Ensure the content script is not code-split
    target: 'esnext',
    // Output to dist/ for sideloading
    outDir: 'dist',
    emptyOutDir: true,
  },
  define: {
    'process.env.CHECKMAIL_API_BASE_URL': JSON.stringify(process.env.CHECKMAIL_API_BASE_URL || 'http://localhost:8080'),
    'process.env.CHECKMAIL_API_KEY': JSON.stringify(process.env.CHECKMAIL_API_KEY || ''),
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
