import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * Cross-Origin Isolation headers required by:
 *  - SharedArrayBuffer (used by @sqlite.org/sqlite-wasm)
 *  - OPFS  (Origin Private File System)
 *
 * In production (Flask serving the built dist/), add these headers
 * to the Flask response too — see app.py @after_request.
 */
function crossOriginIsolationPlugin() {
  return {
    name: 'cross-origin-isolation',
    configureServer(server) {
      server.middlewares.use((_, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((_, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    crossOriginIsolationPlugin(),
  ],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api': {
        // VITE_API_HOST is set to 'backend' when running inside Docker Compose
        target: `http://${globalThis.process?.env?.VITE_API_HOST ?? 'localhost'}:5001`,
        changeOrigin: true,
      },
    },
  },

  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  // Optimise the sqlite-wasm package: it ships its own wasm bundled,
  // so we exclude it from pre-bundling and let Vite copy the .wasm file.
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },

  worker: {
    format: 'es',
    // Allow the worker to also be treated as a module
    plugins: () => [react()],
  },
})
