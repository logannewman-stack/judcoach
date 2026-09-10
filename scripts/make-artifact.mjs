// Converts the single-file build into an Artifact-ready document fragment:
// the wrapper supplies <!doctype>, <head> and <body>, so we ship only the
// page's own title, styles, root element and inlined script.
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync(new URL('../dist-single/index.html', import.meta.url), 'utf8')

const head = src.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''
const body = src.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? ''

// vite-plugin-singlefile inlines both the stylesheet and the module script into
// <head>; charset/viewport/manifest/icon links are the wrapper's job or point at
// files the artifact doesn't ship, so they are dropped.
const styles = [...head.matchAll(/<style[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n')
const scripts = [...head.matchAll(/<script[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n')

if (!scripts.trim()) throw new Error('No inlined script found — did the singlefile build run?')

const out = `<title>GRIT</title>
${styles}
${body.trim()}
${scripts}
`

writeFileSync(new URL('../dist-single/artifact.html', import.meta.url), out)
console.log(`artifact.html — ${(out.length / 1024).toFixed(0)} KB`)
