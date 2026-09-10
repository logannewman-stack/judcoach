import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// SINGLE_FILE=1 produces one self-contained index.html (used for the shareable
// phone preview). The default build emits a normal hashed-asset PWA bundle.
const singleFile = process.env.SINGLE_FILE === '1'

export default defineConfig({
  base: './',
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  // Without this the dep scanner also crawls dist-single/index.html, whose
  // inlined bundle references packages the source never imports — so `npm run
  // dev` refuses to start after anyone has run a single-file build.
  optimizeDeps: { entries: ['index.html'] },
  build: {
    outDir: singleFile ? 'dist-single' : 'dist',
    target: 'es2020',
    cssCodeSplit: !singleFile,
    assetsInlineLimit: singleFile ? 100000000 : 4096,
  },
})
