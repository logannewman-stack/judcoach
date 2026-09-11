// Measures how much colour is actually on the screen, per screen, in both
// appearances. `npm run palette`
//
// The app has twice been rebuilt into something austere — first stock iOS, then
// a grey instrument — and both times every other check passed, because nothing
// measured the one quality that was lost. DESIGN.md §2 says colour is not
// rationed here; this is what says whether that is true of the pixels or only
// of the document.
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { inflateSync } from 'node:zlib'

/* ------------------------------- PNG decode ------------------------------ */

/**
 * Enough of the format for what Chromium emits: 8 bits a channel, RGB or RGBA,
 * not interlaced. Returns {w, h, px} with px as RGBA bytes.
 */
function decodePNG(buf) {
  let at = 8 // past the signature
  let w = 0, h = 0, channels = 0
  const idat = []
  while (at < buf.length) {
    const len = buf.readUInt32BE(at)
    const type = buf.toString('ascii', at + 4, at + 8)
    const data = buf.subarray(at + 8, at + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      if (data[8] !== 8) throw new Error(`bit depth ${data[8]} unsupported`)
      if (data[12] !== 0) throw new Error('interlaced PNG unsupported')
      channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0
      if (!channels) throw new Error(`colour type ${data[9]} unsupported`)
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    at += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * channels
  const out = Buffer.alloc(w * h * channels)
  for (let y = 0; y < h; y += 1) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    const cur = out.subarray(y * stride, (y + 1) * stride)
    const up = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? cur[i - channels] : 0
      const b = up ? up[i] : 0
      const c = up && i >= channels ? up[i - channels] : 0
      let v = line[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      cur[i] = v & 0xff
    }
  }
  return { w, h, px: out, channels }
}

/* ------------------------------ measurement ------------------------------ */

const HUES = [
  [345, 15, 'red'], [15, 45, 'orange'], [45, 70, 'yellow'], [70, 160, 'green'],
  [160, 200, 'teal'], [200, 250, 'blue'], [250, 290, 'indigo'], [290, 345, 'pink'],
]
const hueName = (deg) => HUES.find(([a, b]) => (a < b ? deg >= a && deg < b : deg >= a || deg < b))?.[2] ?? 'red'

/**
 * The share of the screen carrying real colour, and which hues carry it.
 * "Real" is saturation past 0.18: below that a pixel is a tinted grey, which is
 * what an austere screen is made of and is exactly what must not count.
 */
function measure(png) {
  const { px, channels } = png
  const n = px.length / channels
  let coloured = 0
  const hues = new Map()
  for (let i = 0; i < n; i += 1) {
    const o = i * channels
    const r = px[o] / 255, g = px[o + 1] / 255, b = px[o + 2] / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    if (sat < 0.18 || max < 0.12) continue
    coloured += 1
    const d = max - min
    let deg = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    deg = (deg * 60 + 360) % 360
    const name = hueName(deg)
    hues.set(name, (hues.get(name) ?? 0) + 1)
  }
  const top = [...hues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  return {
    share: coloured / n,
    hues: top.map(([name, c]) => `${name} ${Math.round((c / coloured) * 100)}%`),
  }
}

/* --------------------------------- walk ---------------------------------- */

const ROUTES = [
  ['today', 'today', null],
  ['train', 'train', null],
  ['train', 'session', { weekIndex: 5, sessionId: 'w5-lowerA' }],
  ['train', 'history', null],
  ['train', 'exerciseLibrary', null],
  ['train', 'rpeGuide', null],
  ['train', 'prs', null],
  ['meals', 'meals', null],
  ['meals', 'mealDetail', 'MEAL'],
  ['meals', 'grocery', null],
  ['meals', 'guidelines', null],
  ['weigh', 'weigh', null],
  ['weigh', 'measurements', null],
  ['weigh', 'photos', null],
  ['weigh', 'checkIns', null],
  ['settings', 'settings', null],
  ['settings', 'messages', null],
  ['settings', 'appearance', null],
  ['settings', 'trainingMaxes', null],
]

/* A screen below this is grey, whatever its stylesheet says it is. Settings
   pages are mostly white paper with coloured icon tiles, so the floor is what a
   page of inset lists clears, not what Today does. */
const FLOOR = 0.02

const server = await createServer({ server: { port: 5188 } })
await server.listen()
const url = server.resolvedUrls?.local?.[0]
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })

const grey = []
for (const scheme of ['light', 'dark']) {
  console.log(`\n--- ${scheme} ---`)
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: scheme,
  })
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__store, null, { timeout: 20000 })
  await page.evaluate(() => window.__store.getState().completeOnboarding())
  await page.waitForTimeout(400)

  for (const [tab, key, rawParams] of ROUTES) {
    await page.evaluate(({ tab, key, rawParams }) => {
      const nav = window.__nav
      const st = nav.getState()
      st.dismiss()
      nav.setState({ tab, stacks: { ...st.stacks, [tab]: [st.stacks[tab][0]] } })
      if (key === tab) return
      const params = rawParams === 'MEAL'
        ? { mealId: 'meal-3', date: new Date().toISOString().slice(0, 10) }
        : rawParams
      nav.getState().push(key, params ?? undefined)
    }, { tab, key, rawParams })
    await page.waitForTimeout(560)
    const { share, hues } = measure(decodePNG(await page.screenshot()))
    const pct = (share * 100).toFixed(1)
    const low = share < FLOOR
    if (low) grey.push(`${scheme}/${key}`)
    console.log(`${low ? 'GREY' : 'ok  '} ${key.padEnd(18)} ${pct.padStart(5)}%  ${hues.join(' · ')}`)
  }
  await ctx.close()
}

await browser.close()
await server.close()
if (grey.length) {
  console.log(`\n${grey.length} screens under ${FLOOR * 100}% colour: ${grey.join(', ')}`)
  process.exit(1)
}
console.log('\nEvery screen carries colour.')
