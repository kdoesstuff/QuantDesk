import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' keeps asset paths relative so the build runs from any folder
// (GitHub Pages subpath, a preview, or a local file).
export default defineConfig({
  plugins: [react()],
  base: './',
})
