import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Content security policy for the production page. Scripts may only come
 * from the site itself, styles from the site and Google Fonts, fonts from
 * Google's font host, images from the site or inline data. Nothing may be
 * loaded or posted anywhere else. Added at build time only, because the
 * dev server injects its own inline helpers for hot reload.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ')

function csp(): Plugin {
  return {
    name: 'qd-csp',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
  }
}

// base './' keeps asset paths relative so the build runs from any folder
// (GitHub Pages subpath, a preview, or a local file).
export default defineConfig({
  plugins: [react(), csp()],
  base: './',
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three'
          if (id.includes('node_modules/d3')) return 'd3'
          return undefined
        },
      },
    },
  },
})
