// Tiles the walkthrough screenshots into one reviewable sheet.
import { chromium } from 'playwright'
import { readdirSync, readFileSync } from 'node:fs'

const dir = process.argv[2]
const out = process.argv[3]
const only = process.argv[4] ? process.argv[4].split(',') : null
let files = readdirSync(dir).filter((f) => f.endsWith('.png'))
if (only) files = only.map((n) => `${n}.png`).filter((f) => files.includes(f))

const cols = Math.min(4, files.length)
const html = `<style>
  body{margin:0;background:#111;font:11px -apple-system,sans-serif;color:#aaa}
  .grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px;padding:10px}
  figure{margin:0}
  img{width:100%;display:block;border-radius:6px;background:#222}
  figcaption{padding:4px 2px;text-align:center}
</style><div class="grid">${files
  .map((f) => `<figure><img src="data:image/png;base64,${readFileSync(`${dir}/${f}`).toString('base64')}"><figcaption>${f.replace('.png', '')}</figcaption></figure>`)
  .join('')}</div>`

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
await page.setContent(html)
await page.waitForTimeout(600)
await page.screenshot({ path: out, fullPage: true })
await browser.close()
console.log(`${files.length} tiles -> ${out}`)
