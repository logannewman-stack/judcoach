import { chromium } from 'playwright'
const O = '/tmp/claude-0/-home-user-judcoach/7ad0c1e1-11ae-5742-a014-244363a589fe/scratchpad/settings'
import { mkdirSync } from 'node:fs'
mkdirSync(O, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await (await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })).newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto('http://127.0.0.1:5177/', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.evaluate(() => window.__store.getState().completeOnboarding())
for (const key of ['settings', 'profileSettings', 'trainingMaxes', 'equipment', 'appearance', 'dataSettings', 'coach', 'programSettings']) {
  await page.evaluate((k) => {
    const n = window.__nav.getState()
    n.setState ? null : null
    window.__nav.setState({ tab: 'settings', stacks: { ...n.stacks, settings: [n.stacks.settings[0]] } })
    if (k !== 'settings') window.__nav.getState().push(k)
  }, key)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${O}/${key}.png` })
}
// back label check: Today -> Coach -> Check-ins
await page.evaluate(() => { const n = window.__nav.getState(); n.switchTab('today'); n.push('coach') })
await page.waitForTimeout(500)
await page.evaluate(() => window.__nav.getState().push('checkIns'))
await page.waitForTimeout(600)
console.log('back label on Today>Coach>Check-ins:', await page.evaluate(() => document.querySelector('[data-stack-active="true"] .nav-btn')?.innerText.trim()))
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no errors')
await browser.close()
