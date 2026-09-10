// Tiles screenshots into one reviewable sheet.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const files = process.argv.slice(3)
const out = process.argv[2]
const cols = Math.min(4, files.length)
const html = `<style>
  body{margin:0;background:#111;font:11px -apple-system,sans-serif;color:#aaa}
  .grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px;padding:10px}
  figure{margin:0} img{width:100%;display:block;border-radius:6px;background:#222}
  figcaption{padding:4px 2px;text-align:center}
</style><div class="grid">${files
  .map((f) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption>${f.split('/').pop().replace('.png', '')}</figcaption></figure>`)
  .join('')}</div>`

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
await page.setContent(html)
await page.waitForTimeout(500)
await page.screenshot({ path: out, fullPage: true })
await browser.close()
console.log(`${files.length} tiles -> ${out}`)
