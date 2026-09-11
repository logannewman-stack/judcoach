/* ============================================================================
   QR, model 2, byte mode, error correction level M.

   Hand-rolled because the app does not take a dependency for one 116px square
   on one surface, and because the only string this ever encodes is the URL the
   page is already being served from: short, ASCII, and known to fit.

   Versions 1–10 (up to 213 bytes at level M). Past that a URL has stopped being
   something anyone would point a camera at, and the caller shows the address as
   text instead.
   ========================================================================== */

/** GF(256) under the QR primitive polynomial x⁸ + x⁴ + x³ + x² + 1. */
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
for (let i = 0, x = 1; i < 255; i += 1) {
  EXP[i] = x
  LOG[x] = i
  x <<= 1
  if (x & 0x100) x ^= 0x11d
}
for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255]

const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

/** Per version at level M: EC codewords per block, then the two block groups. */
const BLOCKS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
]

/** Alignment-pattern centres, every pairing of which carries a pattern. */
const ALIGN: ReadonlyArray<readonly number[]> = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
]

/** Bits the symbol carries past the last interleaved codeword. */
const REMAINDER = [0, 7, 7, 7, 7, 7, 0, 0, 0, 0]

/** The eight mask patterns, as the spec numbers them. */
const MASKS: ReadonlyArray<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

const dataCodewords = (version: number) => {
  const [, g1, d1, g2, d2] = BLOCKS[version - 1]
  return g1 * d1 + g2 * d2
}

/** Bytes a version holds once the mode nibble and the length field are paid. */
const capacity = (version: number) =>
  Math.floor((dataCodewords(version) * 8 - 4 - (version < 10 ? 8 : 16)) / 8)

function rsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1)
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j]
      next[j + 1] ^= mul(poly[j], EXP[i])
    }
    poly = next
  }
  return poly
}

function rsRemainder(data: Uint8Array, gen: Uint8Array): Uint8Array {
  const degree = gen.length - 1
  const out = new Uint8Array(degree)
  for (const byte of data) {
    const factor = byte ^ out[0]
    out.copyWithin(0, 1)
    out[degree - 1] = 0
    for (let i = 0; i < degree; i += 1) out[i] ^= mul(gen[i + 1], factor)
  }
  return out
}

/** Data codewords in, blocks interleaved with their error correction out. */
function interleave(version: number, data: Uint8Array): Uint8Array {
  const [ec, g1, d1, g2, d2] = BLOCKS[version - 1]
  const gen = rsGenerator(ec)
  const blocks: Uint8Array[] = []
  const checks: Uint8Array[] = []
  let at = 0
  for (const [count, length] of [[g1, d1], [g2, d2]]) {
    for (let i = 0; i < count; i += 1) {
      const block = data.subarray(at, at + length)
      at += length
      blocks.push(block)
      checks.push(rsRemainder(block, gen))
    }
  }
  const out: number[] = []
  for (let i = 0; i < Math.max(d1, d2); i += 1) {
    for (const block of blocks) if (i < block.length) out.push(block[i])
  }
  for (let i = 0; i < ec; i += 1) for (const check of checks) out.push(check[i])
  return Uint8Array.from(out)
}

/** The fifteen format cells, in bit order, for each of the symbol's two copies. */
function formatCells(size: number): Array<Array<[number, number]>> {
  const a: Array<[number, number]> = []
  for (let i = 0; i <= 5; i += 1) a.push([8, i])
  a.push([8, 7], [8, 8], [7, 8])
  for (let i = 9; i < 15; i += 1) a.push([14 - i, 8])
  const b: Array<[number, number]> = []
  for (let i = 0; i < 8; i += 1) b.push([size - 1 - i, 8])
  for (let i = 8; i < 15; i += 1) b.push([8, size - 15 + i])
  return [a, b]
}

/** BCH(15,5) format information, masked as the spec requires. */
function formatBits(mask: number): number {
  // Level M is 0b00, so the five-bit field is the mask alone.
  const data = mask
  let rem = data
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  return ((data << 10) | rem) ^ 0x5412
}

/** BCH(18,6) version information, carried only from version 7. */
function versionBits(version: number): number {
  let rem = version
  for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
  return (version << 12) | rem
}

/* Penalty rules 1–4. Every mask yields a readable symbol; the score only picks
   the one a camera has the easiest time with, so rule 3 is scored by the plain
   1:1:3:1:1 window scan rather than by run-history bookkeeping. */
const FINDER_LIKE = [
  [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1],
]

function penalty(dark: Uint8Array, size: number): number {
  let score = 0
  const at = (x: number, y: number) => dark[y * size + x]

  for (let pass = 0; pass < 2; pass += 1) {
    for (let a = 0; a < size; a += 1) {
      const line = new Uint8Array(size)
      for (let b = 0; b < size; b += 1) line[b] = pass === 0 ? at(b, a) : at(a, b)

      let run = 1
      for (let b = 1; b < size; b += 1) {
        if (line[b] === line[b - 1]) {
          run += 1
          if (run === 5) score += 3
          else if (run > 5) score += 1
        } else run = 1
      }
      for (let b = 0; b + 11 <= size; b += 1) {
        for (const want of FINDER_LIKE) {
          let hit = true
          for (let k = 0; k < 11 && hit; k += 1) if (line[b + k] !== want[k]) hit = false
          if (hit) score += 40
        }
      }
    }
  }

  for (let y = 0; y + 1 < size; y += 1) {
    for (let x = 0; x + 1 < size; x += 1) {
      const c = at(x, y)
      if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) score += 3
    }
  }

  let count = 0
  for (const m of dark) count += m
  const total = size * size
  score += (Math.ceil((Math.abs(count * 20 - total * 10) / total)) - 1) * 10
  return score
}

export type QrMatrix = {
  /** Modules per side, quiet zone excluded. */
  size: number
  dark: (x: number, y: number) => boolean
}

/** Null when the text is longer than a symbol anyone would scan. */
export function encodeQr(text: string): QrMatrix | null {
  const bytes = new TextEncoder().encode(text)
  let version = 0
  for (let v = 1; v <= BLOCKS.length; v += 1) {
    if (bytes.length <= capacity(v)) { version = v; break }
  }
  if (version === 0) return null

  /* ---- the bit stream ---- */
  const bits: number[] = []
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, version < 10 ? 8 : 16)
  for (const byte of bytes) push(byte, 8)

  const room = dataCodewords(version) * 8
  push(0, Math.min(4, room - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)

  const data = new Uint8Array(dataCodewords(version))
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j]
    data[i / 8] = byte
  }
  for (let i = bits.length / 8, pad = 0; i < data.length; i += 1, pad += 1) {
    data[i] = pad % 2 === 0 ? 0xec : 0x11
  }
  const codewords = interleave(version, data)

  /* ---- the symbol ---- */
  const size = version * 4 + 17
  const dark = new Uint8Array(size * size)
  const fixed = new Uint8Array(size * size)
  const set = (x: number, y: number, on: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    dark[y * size + x] = on ? 1 : 0
    fixed[y * size + x] = 1
  }

  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }
  // Drawn after the timing rows, which run under them and must not win.
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const ring = Math.max(Math.abs(dx), Math.abs(dy))
        set(cx + dx, cy + dy, ring !== 2 && ring !== 4)
      }
    }
  }
  const centres = ALIGN[version - 1]
  for (const cy of centres) {
    for (const cx of centres) {
      const onFinder = (cx === 6 && cy === 6)
        || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)
      if (onFinder) continue
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
        }
      }
    }
  }

  const format = formatCells(size)
  for (const copy of format) for (const [x, y] of copy) set(x, y, false)
  set(8, size - 8, true)

  if (version >= 7) {
    const bitsV = versionBits(version)
    for (let i = 0; i < 18; i += 1) {
      const on = ((bitsV >>> i) & 1) === 1
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      set(a, b, on)
      set(b, a, on)
    }
  }

  /* ---- the payload, up the right-hand column pair and down the next ---- */
  const stream = codewords.length * 8 + REMAINDER[version - 1]
  let bit = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let step = 0; step < size; step += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - step : step
        if (fixed[y * size + x] || bit >= stream) continue
        const byte = codewords[bit >>> 3]
        // Past the last codeword the symbol carries remainder bits, all light.
        dark[y * size + x] = byte === undefined ? 0 : (byte >>> (7 - (bit & 7))) & 1
        bit += 1
      }
    }
  }

  /* ---- the mask the camera will like most ---- */
  let best = 0
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask += 1) {
    applyMask(dark, fixed, size, mask)
    writeFormat(dark, size, format, formatBits(mask))
    const score = penalty(dark, size)
    if (score < bestScore) { bestScore = score; best = mask }
    applyMask(dark, fixed, size, mask)
  }
  applyMask(dark, fixed, size, best)
  writeFormat(dark, size, format, formatBits(best))

  return { size, dark: (x, y) => dark[y * size + x] === 1 }
}

function applyMask(dark: Uint8Array, fixed: Uint8Array, size: number, mask: number) {
  const rule = MASKS[mask]
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (fixed[y * size + x]) continue
      if (rule(x, y)) dark[y * size + x] ^= 1
    }
  }
}

function writeFormat(
  dark: Uint8Array,
  size: number,
  cells: Array<Array<[number, number]>>,
  bits: number,
) {
  for (const copy of cells) {
    copy.forEach(([x, y], i) => { dark[y * size + x] = (bits >>> i) & 1 })
  }
}
