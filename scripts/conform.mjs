// Checks the codebase against DESIGN.md. A five-agent makeover drifts unless
// something is watching for a sixth radius, a hard-coded colour, or a press
// state that went back to :active. `npm run conform`
import { readFileSync, globSync } from 'node:fs'

const ALL = globSync('src/**/*.{ts,tsx,css}', { cwd: process.cwd() })
const SRC = ALL.filter((f) => !f.endsWith('tokens.css'))

/* Every custom property the app actually defines, anywhere: a CSS declaration,
   or a key in a React style object. A var() naming anything not in here does
   nothing at all and does it silently, which is the one kind of drift that
   looks fine in review and is invisible in a screenshot. */
const DEFINED = new Set()
for (const file of ALL) {
  const source = readFileSync(file, 'utf8')
  for (const m of source.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) DEFINED.add(m[1])
  for (const m of source.matchAll(/['"`](--[a-zA-Z0-9-]+)['"`]/g)) DEFINED.add(m[1])
}

/** Radii DESIGN.md §3 allows, in px, plus 50%/999px for a circle or pill. */
const RADII = new Set(['14', '16', '18', '22', '28', '50%', '999', '9999', '0'])

const findings = []
const add = (kind, file, line, text) => findings.push({ kind, where: `${file}:${line}`, text })

for (const file of SRC) {
  const source = readFileSync(file, 'utf8')
  // Blank out comments rather than dropping them, so line numbers survive.
  // Without this the check reports every comment that says not to use :active.
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))
  const lines = stripped.split('\n')
  const raw = source.split('\n')

  // A file-level exemption, stated once at the top with its reason.
  const exemptFile = /conform-allow-file/.test(source.slice(0, 1200))

  lines.forEach((code, i) => {
    const n = i + 1
    if (exemptFile) return
    // A deliberate exception, stated on the line or in the comment above it.
    // Reasons run to two or three lines, so look back as far as one plausibly does.
    if ([0, 1, 2, 3].some((back) => /conform-allow/.test(raw[i - back] ?? ''))) return

    // A shadow is defined in ink, not in a theme colour, so the token that
    // declares one is allowed to spell it out.
    const definesShadow = /--[a-z-]*shadow[a-z-]*\s*:/.test(code)

    // A colour literal outside tokens.css cannot follow the theme.
    const hex = code.match(/#[0-9a-fA-F]{3,8}\b/g)
    if (hex && !definesShadow) {
      for (const h of hex) {
        // White and black on an accent fill are not theme colours, they are
        // "the colour of type on the accent". #0000 is a transparent shadow.
        if (/^#(fff|ffffff|000|000000|0000)$/i.test(h)) continue
        add('colour', file, n, `${h} — ${code.trim().slice(0, 66)}`)
      }
    }
    if (/\brgba?\(\s*\d+\s*,/.test(code) && !/var\(--/.test(code) && !definesShadow) {
      add('colour', file, n, `rgba literal — ${code.trim().slice(0, 60)}`)
    }

    // A var() that names nothing resolves to nothing, so the declaration is
    // dropped and the element quietly keeps whatever it inherited.
    for (const m of code.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*([,)])/g)) {
      // A var() with a fallback is a deliberate "if this is set" and is fine.
      if (m[2] === ',') continue
      if (!DEFINED.has(m[1])) add('token', file, n, `${m[1]} is never defined`)
    }

    // DESIGN.md §7: no monospace. The app was once mistaken for a trading
    // terminal and a ledger of mono digits is how it got there.
    if (/font-family|font:/.test(code) && /monospace|SFMono|SF Mono|Menlo|JetBrains|Consolas|Courier|Roboto Mono/.test(code)) {
      add('mono', file, n, code.trim().slice(0, 72))
    }

    // Press state must come from pointer events, not the browser's late :active.
    if (file.endsWith('.css') && /:active\b/.test(code)) {
      add('active', file, n, code.trim().slice(0, 72))
    }

    // Radii and shadows come from tokens.
    const radius = code.match(/border-?[Rr]adius:\s*'?([^,;'"}]+)/)
    if (radius) {
      const value = radius[1].trim().replace(/px$/, '')
      const ok = value.includes('var(') || RADII.has(value)
        || value.split(/\s+/).every((v) => RADII.has(v.replace(/px$/, '')))
      if (!ok) add('radius', file, n, `${radius[1].trim()} — ${code.trim().slice(0, 50)}`)
    }
    // Take the whole expression, so a ternary is judged on its values rather
    // than on the condition in front of them.
    const shadow = code.match(/box-?[Ss]hadow:\s*([^;}]+)/)
    // A transparent shadow is an animation's end state, not an elevation.
    if (shadow && !/var\(--|inset|none|transparent/.test(shadow[1])) {
      add('shadow', file, n, `${shadow[1].trim().slice(0, 44)} — ${file}`)
    }
  })
}

const KINDS = [
  ['colour', 'colour literals that cannot follow the theme'],
  ['active', ':active press states (use data-pressed)'],
  ['radius', 'radii DESIGN.md \u00a71 does not name'],
  ['shadow', 'shadows not from a token'],
  ['token', 'var() naming a property nothing defines'],
  ['mono', 'monospace faces (DESIGN.md \u00a77 bans them)'],
]

const cap = Number(process.env.CONFORM_LIST ?? 12)
let total = 0
for (const [kind, label] of KINDS) {
  const hits = findings.filter((f) => f.kind === kind)
  total += hits.length
  console.log(`--- ${label}: ${hits.length}`)
  hits.slice(0, cap).forEach((f) => console.log(`    ${f.where}  ${f.text}`))
  if (hits.length > cap) console.log(`    ... and ${hits.length - cap} more`)
}

const budget = Number(process.env.CONFORM_BUDGET ?? 0)
console.log(total <= budget ? '\nConforms.' : `\n${total} to bring onto the system.`)
process.exit(total <= budget ? 0 : 1)
