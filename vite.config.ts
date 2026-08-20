import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  /**
   * Emit imported JSON as a single `JSON.parse('…')` rather than an object
   * literal. The delivery history is 374 KB of data, and V8 parses JSON
   * substantially faster than it parses the equivalent JavaScript source — the
   * literal has to go through the full parser, the string does not.
   */
  json: { stringify: true },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  build: {
    rollupOptions: {
      output: {
        /**
         * Keep the framework in its own chunk. It changes on a dependency bump
         * and the application changes on every deploy, so sharing a chunk means
         * every deploy re-downloads React for everybody.
         */
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (id.includes('@tanstack/react-router')) return 'router'
          if (id.includes('@tanstack/react-query')) return 'query'
        },
      },
    },
  },
  server: {
    /* 5173 unless the environment names one, so two checkouts — or two agent
       sessions — can run dev servers side by side without editing this file. */
    port: Number(process.env.PORT ?? 5173),
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
