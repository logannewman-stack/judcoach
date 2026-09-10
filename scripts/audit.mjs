// Accessibility and layout audit: unlabelled controls, sub-44pt touch
// targets, and horizontal overflow in landscape.
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
const O = process.argv[2] ?? './.audit'
const ROUTES = ['today','train','meals','weigh','settings','session','history','exerciseLibrary','rpeGuide','prs','mealDetail','grocery','measurements','checkIns','profileSettings','trainingMaxes','equipment','appearance','dataSettings','coach']
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:5177/', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.evaluate(() => window.__store.getState().completeOnboarding())
await page.waitForTimeout(400)

const problems = []
for (const key of ROUTES) {
  await page.evaluate((k) => {
    const nav = window.__nav
    const st = nav.getState()
    const tab = ['today'].includes(k) ? 'today'
      : ['train','session','history','exerciseLibrary','rpeGuide','prs'].includes(k) ? 'train'
      : ['meals','mealDetail','grocery'].includes(k) ? 'meals'
      : ['weigh','measurements','checkIns'].includes(k) ? 'weigh' : 'settings'
    nav.setState({ tab, stacks: { ...st.stacks, [tab]: [st.stacks[tab][0]] } })
    if (k !== tab) {
      const params = k === 'session' ? { weekIndex: 5, sessionId: 'w5-lowerA' }
        : k === 'mealDetail' ? { mealId: 'meal-3', date: new Date().toISOString().slice(0,10) } : undefined
      nav.getState().push(k, params)
    }
  }, key)
  await page.waitForTimeout(450)
  const found = await page.evaluate((k) => {
    const root = document.querySelector('[data-stack-active="true"]')
    if (!root) return []
    const out = []
    for (const el of root.querySelectorAll('button, a, input, textarea, [role="switch"], [role="tab"]')) {
      if (el.closest('[aria-hidden="true"]')) continue
      const name = (el.getAttribute('aria-label') || el.textContent || '').trim()
      if (!name) out.push(`${k}: <${el.tagName.toLowerCase()}> "${(el.className || '').toString().slice(0,40)}" has no accessible name`)
      // UISegmentedControl segments are 28pt tall on iOS itself; matching the
      // platform beats padding them out to 44.
      if (el.classList.contains('segment')) continue
      const r = el.getBoundingClientRect()
      if (r.width > 0 && (r.width < 30 || r.height < 30)) {
        // .hit-expand grows the touch target with a pseudo-element, which
        // getBoundingClientRect can't see — measure that instead.
        const after = getComputedStyle(el, '::after')
        const hitW = Math.max(r.width, parseFloat(after.width) || 0)
        const hitH = Math.max(r.height, parseFloat(after.height) || 0)
        if (hitW < 30 || hitH < 30) {
          out.push(`${k}: small target ${Math.round(hitW)}×${Math.round(hitH)} — "${name.slice(0,28)}"`)
        }
      }
    }
    return out
  }, key)
  problems.push(...found)
}
const noName = problems.filter((p) => p.includes('no accessible name'))
const small = problems.filter((p) => p.includes('small target'))
console.log(`--- unlabelled: ${noName.length}`)
noName.slice(0, 12).forEach((p) => console.log('  ' + p))
console.log(`--- small tap targets: ${small.length}`)
small.slice(0, 20).forEach((p) => console.log('  ' + p))

// landscape sanity
const land = await browser.newContext({ viewport: { width: 852, height: 393 }, isMobile: true, hasTouch: true })
const lp = await land.newPage()
await lp.goto('http://127.0.0.1:5177/', { waitUntil: 'networkidle' })
await lp.waitForTimeout(600)
await lp.evaluate(() => window.__store.getState().completeOnboarding())
await lp.waitForTimeout(600)
await mkdir(O, { recursive: true })
await lp.screenshot({ path: `${O}/landscape.png` })
const overflow = await lp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
console.log('landscape horizontal overflow:', overflow)
await browser.close()
