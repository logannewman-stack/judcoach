// Generates the GRIT app icons with zero dependencies.
// Supersampled SDF rendering -> raw RGBA -> PNG via node:zlib.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'

const SS = 4 // supersampling factor per axis

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const mix = (a, b, t) => a + (b - a) * t
const DEG = Math.PI / 180

/** Signed distance to a rounded rect centred at (cx,cy), half-extents (hx,hy). */
function sdRoundRect(px, py, cx, cy, hx, hy, r) {
  const qx = Math.abs(px - cx) - (hx - r)
  const qy = Math.abs(py - cy) - (hy - r)
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r
}

/* ---------------------------------------------------------------------------
   The GRIT "G": a heavy geometric ring, knife-cut open on the upper right and
   closed by a flat spur. Sheared forward so the letter leans into the run.
   ------------------------------------------------------------------------- */
const G = {
  cx: 0.5,
  cy: 0.5,
  rMid: 0.278,
  half: 0.088, // half stroke thickness — deliberately heavy
  gapTo: 58, // degrees anticlockwise from +x, y up
  shear: 0.16, // forward lean
}
// Start the opening exactly where the spur's top edge meets the outer radius,
// so no sliver of ring is left poking above the crossbar.
G.rOuter = G.rMid + G.half
G.gapFrom = (Math.asin(G.half / G.rOuter) / DEG)

function gMark(x, y) {
  // Undo the forward lean before evaluating the upright shape.
  const px = x + G.shear * (y - G.cy)
  const py = y

  const dx = px - G.cx
  const dy = G.cy - py // flip so angles read anticlockwise
  const r = Math.hypot(dx, dy)

  if (Math.abs(r - G.rMid) <= G.half) {
    let ang = Math.atan2(dy, dx) / DEG
    if (ang < 0) ang += 360
    if (!(ang > G.gapFrom - 0.001 && ang < G.gapTo)) return 1
  }
  // Flat-capped spur from the centre out to the ring's outer edge.
  if (px >= G.cx && px <= G.cx + G.rOuter && Math.abs(py - G.cy) <= G.half) return 1
  return 0
}

function renderIcon(size, { rounded = false } = {}) {
  const px = Buffer.alloc(size * size * 4)
  const inv = 1 / (size * SS)
  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let br = 0, bg = 0, bb = 0, ba = 0, mark = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (pxi * SS + sx + 0.5) * inv
          const v = (py * SS + sy + 0.5) * inv

          // --- background: graphite gradient + cool radial sheen ---
          let r = mix(0.094, 0.043, v)
          let g = mix(0.094, 0.043, v)
          let b = mix(0.106, 0.051, v)
          const d = Math.hypot(u - 0.28, v - 0.16) / 0.95
          const glow = Math.pow(1 - clamp01(d), 2.1) * 0.34
          r += (0.039 - r) * glow
          g += (0.517 - g) * glow
          b += (1.0 - b) * glow
          const d2 = Math.hypot(u - 0.82, v - 1.02) / 0.8
          const glow2 = Math.pow(1 - clamp01(d2), 2.6) * 0.16
          r += (0.37 - r) * glow2
          g += (0.35 - g) * glow2
          b += (0.92 - b) * glow2

          // iOS masks home-screen icons itself, so only the favicon needs
          // its own corners.
          let alpha = 1
          if (rounded) alpha = sdRoundRect(u, v, 0.5, 0.5, 0.5, 0.5, 0.2237) <= 0 ? 1 : 0

          br += r * alpha; bg += g * alpha; bb += b * alpha; ba += alpha
          mark += gMark(u, v) * alpha
        }
      }
      const n = SS * SS
      const cov = mark / n
      const a = ba / n
      let r = br / n, g = bg / n, b = bb / n
      r = mix(r, 1, cov); g = mix(g, 1, cov); b = mix(b, 1, cov)
      const o = (py * size + pxi) * 4
      px[o] = Math.round(clamp01(a ? r / a : r) * 255)
      px[o + 1] = Math.round(clamp01(a ? g / a : g) * 255)
      px[o + 2] = Math.round(clamp01(a ? b / a : b) * 255)
      px[o + 3] = Math.round(a * 255)
    }
  }
  return px
}

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/**
 * `up` selects PNG filter type 2 for every row but the first. A launch image is
 * a vertical gradient, so each row is nearly identical to the one above it and
 * the filtered bytes are almost all zero — a 1320x2868 splash lands in single-
 * digit kilobytes instead of megabytes.
 */
function encodePNG(w, h, rgba, { up = false } = {}) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const row = w * 4
  const stride = row + 1
  const raw = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const at = y * stride
    if (up && y > 0) {
      raw[at] = 2
      for (let i = 0; i < row; i++) {
        raw[at + 1 + i] = (rgba[y * row + i] - rgba[(y - 1) * row + i]) & 0xff
      }
    } else {
      raw[at] = 0
      rgba.copy(raw, at + 1, y * row, (y + 1) * row)
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [180, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), encodePNG(size, size, renderIcon(size)))
  console.log(`public/icon-${size}.png`)
}
writeFileSync(new URL('../public/favicon-64.png', import.meta.url), encodePNG(64, 64, renderIcon(64, { rounded: true })))
console.log('public/favicon-64.png')

/* ------------------------------ vector icon ------------------------------ */

/** Point on a circle at angle `deg`, measured anticlockwise from +x with y up. */
function onCircle(r, deg) {
  const a = deg * DEG
  return [G.cx + r * Math.cos(a), G.cy - r * Math.sin(a)]
}

const f = (n) => Number(n.toFixed(4))
const pt = ([x, y]) => `${f(x)} ${f(y)}`

/**
 * The same mark as the raster icons, as real geometry. A browser tab renders the
 * favicon at whatever size it likes and on whatever background, so the vector is
 * the one that stays crisp.
 */
function iconSvg() {
  const rO = G.rMid + G.half
  const rI = G.rMid - G.half
  const end = G.gapFrom + 360

  // Ring: outer edge anticlockwise from the gap's far side all the way round,
  // then back along the inner edge. sweep-flag 0 is anticlockwise on screen
  // because the y axis points down.
  const ring = [
    `M ${pt(onCircle(rO, G.gapTo))}`,
    `A ${f(rO)} ${f(rO)} 0 1 0 ${pt(onCircle(rO, end))}`,
    `L ${pt(onCircle(rI, end))}`,
    `A ${f(rI)} ${f(rI)} 0 1 1 ${pt(onCircle(rI, G.gapTo))}`,
    'Z',
  ].join(' ')

  // Flat-capped spur closing the letter, centre out to the ring's outer edge.
  const spur = `M ${f(G.cx)} ${f(G.cy - G.half)} H ${f(G.cx + rO)} V ${f(G.cy + G.half)} H ${f(G.cx)} Z`

  // Matches renderIcon's shear: a point is evaluated at x + shear * (y - cy).
  const lean = `matrix(1 0 ${f(-G.shear)} 1 ${f(G.shear * G.cy)} 0)`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#18181b"/>
      <stop offset="1" stop-color="#0b0b0d"/>
    </linearGradient>
    <radialGradient id="s" cx="0.28" cy="0.16" r="0.95">
      <stop offset="0" stop-color="#0a84ff" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#0a84ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="s2" cx="0.82" cy="1.02" r="0.8">
      <stop offset="0" stop-color="#5e5aeb" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#5e5aeb" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="c"><rect width="1" height="1" rx="0.2237"/></clipPath>
  </defs>
  <g clip-path="url(#c)">
    <rect width="1" height="1" fill="url(#g)"/>
    <rect width="1" height="1" fill="url(#s)"/>
    <rect width="1" height="1" fill="url(#s2)"/>
    <g transform="${lean}" fill="#fff">
      <path d="${ring}"/>
      <path d="${spur}"/>
    </g>
  </g>
</svg>
`
}

writeFileSync(new URL('../public/icon.svg', import.meta.url), iconSvg())
console.log('public/icon.svg')

/* ----------------------------- launch screens ---------------------------- */

/* Without these iOS shows a blank white page while a home-screen app boots,
   which is the single loudest tell that something is a web app. Portrait only —
   the manifest locks orientation.

   Each entry is [css width, css height, dpr]; the pixel size is the product. */
const DEVICES = [
  [440, 956, 3], // iPhone 16 Pro Max
  [430, 932, 3], // 15 Pro Max, 14 Pro Max
  [428, 926, 3], // 12/13/14 Pro Max
  [402, 874, 3], // 16 Pro
  [393, 852, 3], // 15 Pro, 14 Pro
  [390, 844, 3], // 12/13/14, 16e
  [375, 812, 3], // X, XS, 11 Pro, 13 mini
  [414, 896, 3], // XS Max, 11 Pro Max
  [414, 896, 2], // XR, 11
  [375, 667, 2], // SE
]

/** Signed distance to the mark, so the splash antialiases without supersampling. */
function markCoverage(x, y, span) {
  const px = x + G.shear * (y - G.cy)
  const dx = px - G.cx
  const dy = G.cy - y
  const r = Math.hypot(dx, dy)

  let ang = Math.atan2(dy, dx) / DEG
  if (ang < 0) ang += 360
  const inGap = ang > G.gapFrom && ang < G.gapTo
  // Distance to the ring band, treating the gap as absent.
  let d = inGap ? 1 : Math.abs(r - G.rMid) - G.half
  // Distance to the spur: a rectangle from the centre to the outer radius.
  const qx = Math.max(G.cx - px, px - (G.cx + G.rOuter))
  const qy = Math.abs(y - G.cy) - G.half
  const spur = Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  d = Math.min(d, spur)

  return clamp01(0.5 - d / span)
}

function renderSplash(w, h) {
  const px = Buffer.alloc(w * h * 4)
  // The mark sits a touch above centre, the way a launch screen usually does.
  const markSize = Math.round(Math.min(w, h) * 0.26)
  const markX = (w - markSize) / 2
  const markY = h * 0.5 - markSize * 0.62
  const span = 1 / markSize // one pixel, in mark space

  for (let y = 0; y < h; y++) {
    // Row-constant background, which is what makes the Up filter pay off.
    const v = y / (h - 1)
    const br = Math.round(clamp01(mix(0.094, 0.043, v)) * 255)
    const bg = Math.round(clamp01(mix(0.094, 0.043, v)) * 255)
    const bb = Math.round(clamp01(mix(0.106, 0.051, v)) * 255)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      px[o] = br
      px[o + 1] = bg
      px[o + 2] = bb
      px[o + 3] = 255
    }
    if (y < markY || y >= markY + markSize) continue
    const my = (y - markY) / markSize
    for (let x = Math.max(0, Math.floor(markX)); x < Math.min(w, markX + markSize); x++) {
      const cov = markCoverage((x - markX) / markSize, my, span)
      if (cov <= 0) continue
      const o = (y * w + x) * 4
      px[o] = Math.round(mix(px[o], 255, cov))
      px[o + 1] = Math.round(mix(px[o + 1], 255, cov))
      px[o + 2] = Math.round(mix(px[o + 2], 255, cov))
    }
  }
  return px
}

for (const [cw, ch, dpr] of DEVICES) {
  const w = cw * dpr
  const h = ch * dpr
  writeFileSync(
    new URL(`../public/splash-${w}x${h}.png`, import.meta.url),
    encodePNG(w, h, renderSplash(w, h), { up: true }),
  )
  console.log(`public/splash-${w}x${h}.png`)
}

/** The <link> tags index.html needs for the list above. */
console.log('\n--- paste into index.html ---')
for (const [cw, ch, dpr] of DEVICES) {
  console.log(
    `    <link rel="apple-touch-startup-image" href="./splash-${cw * dpr}x${ch * dpr}.png"`
    + ` media="(device-width: ${cw}px) and (device-height: ${ch}px)`
    + ` and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" />`,
  )
}
