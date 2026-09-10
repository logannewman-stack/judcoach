import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://127.0.0.1:5177/'
const out = process.argv[3] ?? '/tmp/claude-0/-home-user-judcoach/7ad0c1e1-11ae-5742-a014-244363a589fe/scratchpad/shot.png'
const scheme = process.argv[4] ?? 'light'
const steps = process.argv[5] ? JSON.parse(process.argv[5]) : []

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 },        // iPhone 15 Pro
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: scheme,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)

for (const step of steps) {
  if (step.click) await page.click(step.click, { timeout: 5000 }).catch((e) => errors.push(`click ${step.click}: ${e.message}`))
  if (step.text) await page.getByText(step.text, { exact: false }).first().click({ timeout: 5000 }).catch((e) => errors.push(`text ${step.text}: ${e.message}`))
  if (step.scroll) await page.evaluate((y) => document.querySelector('.scroll:not([aria-hidden="true"] .scroll)')?.scrollTo(0, y), step.scroll)
  await page.waitForTimeout(step.wait ?? 650)
}

await page.screenshot({ path: out })
if (errors.length) console.log('CONSOLE ERRORS:\n' + errors.join('\n'))
else console.log('no console errors')
await browser.close()
