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

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = size * 4 + 1
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [180, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), encodePNG(size, renderIcon(size)))
  console.log(`public/icon-${size}.png`)
}
writeFileSync(new URL('../public/favicon-64.png', import.meta.url), encodePNG(64, renderIcon(64, { rounded: true })))
console.log('public/favicon-64.png')
