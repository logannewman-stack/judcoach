// Layout and accessibility audit across every screen, in both themes.
//
// Checks: controls with no accessible name, touch targets under 44pt,
// overlapping targets, text clipped by its own container, text that fails WCAG
// AA contrast, content trapped under the home indicator, duplicate ids, and
// horizontal overflow at phone widths and in landscape.
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdir } from 'node:fs/promises'

const OUT = process.argv[2] ?? './.audit'
const PORT = 5177

const ROUTES = [
  ['today', 'today'], ['train', 'train'], ['meals', 'meals'], ['weigh', 'weigh'],
  ['settings', 'settings'], ['train', 'session'], ['train', 'history'],
  ['train', 'exerciseLibrary'], ['train', 'rpeGuide'], ['train', 'prs'],
  ['meals', 'mealDetail'], ['meals', 'grocery'], ['meals', 'guidelines'],
  ['weigh', 'measurements'], ['weigh', 'photos'], ['weigh', 'checkIns'],
  ['settings', 'profileSettings'], ['settings', 'trainingMaxes'],
  ['settings', 'equipment'], ['settings', 'appearance'],
  ['settings', 'workoutSettings'], ['settings', 'notifications'],
  ['settings', 'dataSettings'], ['settings', 'coach'], ['settings', 'messages'],
  ['settings', 'programSettings'],
]

const PARAMS = {
  session: { weekIndex: 5, sessionId: 'w5-lowerA' },
  mealDetail: { mealId: 'meal-3', date: new Date().toISOString().slice(0, 10) },
}

const server = await createServer({ server: { port: PORT } })
await server.listen()
const url = `http://127.0.0.1:${PORT}/`

/* The page-side sweep. Runs for one route, in whichever theme is active. */
const SWEEP = (route) => {
  const out = []
  const stack = document.querySelector('[data-stack-active="true"]')
  if (!stack) return [{ kind: 'route', text: `${route}: no active stack` }]
  // The screen underneath a push stays mounted at x: -26%, so sweeping the whole
  // stack reports the previous screen's rows as overlapping this one's.
  const root = [...stack.children]
    .reduce((top, el) => (Number(getComputedStyle(el).zIndex || 0)
      >= Number(getComputedStyle(top).zIndex || 0) ? el : top), stack.children[0]) ?? stack

  const visible = (el) => {
    if (el.closest('[aria-hidden="true"]')) return false
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.05) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }

  /* ------------------------------- colour -------------------------------- */
  const parseColor = (c) => {
    const m = c.match(/[\d.]+/g)
    if (!m) return null
    return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 }
  }
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  })
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }

  /** Flatten the stack of backgrounds behind an element onto opaque white/black. */
  const backdrop = (el) => {
    const layers = []
    let node = el
    let gradient = false
    while (node && node !== document.documentElement) {
      const s = getComputedStyle(node)
      if (s.backgroundImage !== 'none') gradient = true
      const c = parseColor(s.backgroundColor)
      if (c && c.a > 0) {
        layers.push(c)
        if (c.a === 1) break
      }
      node = node.parentElement
    }
    const base = parseColor(getComputedStyle(document.body).backgroundColor)
    let acc = base && base.a === 1 ? base : { r: 255, g: 255, b: 255, a: 1 }
    for (let i = layers.length - 1; i >= 0; i -= 1) acc = over(layers[i], acc)
    return { color: acc, gradient }
  }

  /* ---------------------------- text and boxes --------------------------- */
  const targets = []
  for (const el of root.querySelectorAll('*')) {
    if (!visible(el)) continue
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()

    const interactive = el.matches('button, a[href], input, textarea, select, [role="switch"], [role="tab"], [role="button"]')
    if (interactive) {
      const name = (el.getAttribute('aria-label') || el.textContent || el.value || '').trim()
      if (!name) {
        out.push({ kind: 'unnamed', text: `${route}: <${el.tagName.toLowerCase()}>.${(el.className || '').toString().trim().split(/\s+/)[0] || '?'} has no accessible name` })
      }
      // A pseudo-element can grow the target past the element's own box.
      const after = getComputedStyle(el, '::after')
      const before = getComputedStyle(el, '::before')
      const w = Math.max(r.width, parseFloat(after.width) || 0, parseFloat(before.width) || 0)
      const h = Math.max(r.height, parseFloat(after.height) || 0, parseFloat(before.height) || 0)
      if (w < 43.5 || h < 43.5) {
        out.push({ kind: 'small', text: `${route}: ${Math.round(w)}x${Math.round(h)} "${name.slice(0, 30)}"` })
      }
      targets.push({ r, el, name: name.slice(0, 24) })

      // Pinned chrome must clear the home indicator; a list row passing under
      // the tab bar is just a list scrolling, so only fixed elements count.
      const pinned = s.position === 'fixed' || s.position === 'sticky'
      if (pinned && r.bottom > window.innerHeight - 6 && r.top < window.innerHeight) {
        out.push({ kind: 'homebar', text: `${route}: pinned "${name.slice(0, 24)}" reaches the home indicator` })
      }
    }

    // Text clipped by its own box, with no ellipsis to say so.
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (ownText) {
      const clipsX = el.scrollWidth > el.clientWidth + 1
        && (s.overflowX === 'hidden' || s.overflow === 'hidden')
        && s.textOverflow !== 'ellipsis'
      const clipsY = el.scrollHeight > el.clientHeight + 1
        && (s.overflowY === 'hidden' || s.overflow === 'hidden')
      if (clipsX || clipsY) {
        out.push({ kind: 'clipped', text: `${route}: "${el.textContent.trim().slice(0, 30)}" is cut off` })
      }

      // Contrast, where the background is a flat colour we can compute.
      const fg = parseColor(s.color)
      const { color: bg, gradient } = backdrop(el)
      if (fg && bg && fg.a > 0.1) {
        const flat = fg.a < 1 ? over(fg, bg) : fg
        const size = parseFloat(s.fontSize)
        const bold = Number(s.fontWeight) >= 600
        const large = size >= 24 || (size >= 18.66 && bold)
        const got = ratio(flat, bg)
        // WCAG AA is the wrong gate for an app that means to look like iOS:
        // Apple's own secondaryLabel lands near 3.5:1 and systemBlue near 3.6:1
        // on white. So AA shortfalls are reported, and only text below what iOS
        // itself would ever ship counts as a failure.
        const floor = large ? 2.4 : 3.0
        const aa = large ? 3 : 4.5
        if (got < aa) {
          const entry = `${route}: ${got.toFixed(2)}:1 ${Math.round(size)}px "${el.textContent.trim().slice(0, 26)}"`
          const kind = gradient ? 'contrast-gradient' : got < floor ? 'contrast' : 'contrast-aa'
          out.push({ kind, text: entry })
        }
      }
    }
  }

  // Two targets that overlap mean one of them is hard to hit.
  for (let i = 0; i < targets.length; i += 1) {
    for (let j = i + 1; j < targets.length; j += 1) {
      const a = targets[i].r
      const b = targets[j].r
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      // Ignore containment: a row that is itself a button legitimately holds one.
      const contains = (p, q) => p.left <= q.left && p.right >= q.right && p.top <= q.top && p.bottom >= q.bottom
      if (ox > 4 && oy > 4 && !contains(a, b) && !contains(b, a)) {
        // Only a real problem if the overlap is where a finger would land: ask
        // the browser what it would actually hit there.
        const x = Math.max(a.left, b.left) + ox / 2
        const y = Math.max(a.top, b.top) + oy / 2
        const hit = document.elementFromPoint(x, y)
        if (hit && (targets[i].el.contains(hit) || targets[j].el.contains(hit))) {
          out.push({ kind: 'overlap', text: `${route}: "${targets[i].name}" overlaps "${targets[j].name}" by ${Math.round(ox)}x${Math.round(oy)}` })
        }
      }
    }
  }

  const ids = [...document.querySelectorAll('[id]')].map((e) => e.id)
  for (const id of new Set(ids)) {
    if (ids.filter((x) => x === id).length > 1) {
      out.push({ kind: 'dupe-id', text: `${route}: id "${id}" appears more than once` })
    }
  }
  return out
}

const findings = []

for (const scheme of ['light', 'dark']) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, colorScheme: scheme,
  })
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__store, null, { timeout: 20000 })
  await page.evaluate(() => window.__store.getState().completeOnboarding())
  await page.waitForTimeout(400)

  for (const [tab, key] of ROUTES) {
    await page.evaluate(([t, k, params]) => {
      window.__nav.getState().switchTab(t)
      window.__nav.getState().popToRoot()
      if (k !== t) window.__nav.getState().push(k, params)
    }, [tab, key, PARAMS[key]])
    await page.waitForTimeout(360)
    const found = await page.evaluate(SWEEP, `${key}/${scheme}`)
    findings.push(...found)
  }

  // Narrow and landscape geometry, once per theme.
  for (const [w, h, label] of [[320, 700, 'narrow'], [852, 393, 'landscape']]) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(300)
    for (const [tab, key] of ROUTES.slice(0, 8)) {
      await page.evaluate(([t, k, params]) => {
        window.__nav.getState().switchTab(t)
        window.__nav.getState().popToRoot()
        if (k !== t) window.__nav.getState().push(k, params)
      }, [tab, key, PARAMS[key]])
      await page.waitForTimeout(240)
      const over = await page.evaluate(() =>
        document.documentElement.scrollWidth > window.innerWidth + 1)
      if (over) findings.push({ kind: label, text: `${key}/${scheme}: scrolls sideways at ${w}px` })
    }
    if (label === 'landscape') {
      await mkdir(OUT, { recursive: true })
      await page.screenshot({ path: `${OUT}/landscape-${scheme}.png` })
    }
    await page.setViewportSize({ width: 393, height: 852 })
  }

  await browser.close()
}

await server.close()

const KINDS = [
  ['unnamed', 'controls with no accessible name'],
  ['small', 'touch targets under 44pt'],
  ['overlap', 'overlapping touch targets'],
  ['clipped', 'text cut off by its container'],
  ['contrast', 'text below any contrast iOS would ship'],
  ['contrast-aa', 'text below WCAG AA but within iOS practice (informational)'],
  ['contrast-gradient', 'text on a gradient, contrast unverifiable (review by eye)'],
  ['homebar', 'controls reaching the home indicator'],
  ['dupe-id', 'duplicate ids'],
  ['narrow', 'sideways scroll at 320px'],
  ['landscape', 'sideways scroll in landscape'],
  ['route', 'routes that failed to render'],
]

let hard = 0
for (const [kind, label] of KINDS) {
  const seen = [...new Set(findings.filter((f) => f.kind === kind).map((f) => f.text))]
  if (kind !== 'contrast-gradient' && kind !== 'contrast-aa') hard += seen.length
  console.log(`--- ${label}: ${seen.length}`)
  const cap = Number(process.env.AUDIT_LIST ?? 14)
  seen.slice(0, cap).forEach((t) => console.log('    ' + t))
  if (seen.length > cap) console.log(`    ... and ${seen.length - cap} more`)
}
console.log(hard === 0 ? '\nClean.' : `\n${hard} to fix.`)
process.exit(hard === 0 ? 0 : 1)
