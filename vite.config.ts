import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * Rewrites the copied service worker with a cache name derived from this
 * build's asset names, and the list of assets to precache.
 *
 * Both matter. A static cache name means a deploy leaves every old hashed chunk
 * cached forever and the browser never sees new worker bytes to install; an
 * empty precache list means the first launch after install has nothing to serve
 * offline, which in a gym basement is the launch that matters.
 */
function stampServiceWorker(): Plugin {
  let outDir = 'dist'
  const assets: string[] = []
  return {
    name: 'grit-stamp-sw',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    generateBundle(_options, bundle) {
      for (const file of Object.keys(bundle)) {
        if (/\.(js|css|woff2?)$/.test(file)) assets.push(`./${file}`)
      }
    },
    closeBundle() {
      const path = resolve(outDir, 'sw.js')
      let source: string
      try {
        source = readFileSync(path, 'utf8')
      } catch {
        return // single-file builds ship no worker
      }
      const version = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 12)
      writeFileSync(
        path,
        source
          .replace("const CACHE = 'grit-dev'", `const CACHE = 'grit-${version}'`)
          .replace('const PRECACHE = []', `const PRECACHE = ${JSON.stringify(assets)}`),
      )
    },
  }
}

// SINGLE_FILE=1 produces one self-contained index.html (used for the shareable
// phone preview). The default build emits a normal hashed-asset PWA bundle.
const singleFile = process.env.SINGLE_FILE === '1'

export default defineConfig({
  base: './',
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [stampServiceWorker()])],
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
