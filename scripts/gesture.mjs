// Drives the edge-swipe back with a real pointer at several speeds and
// distances, and checks each one either pops or springs back. `npm run gesture`
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ server: { port: 5193 } })
await server.listen()
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__store, null, { timeout: 20000 })
await page.evaluate(() => window.__store.getState().completeOnboarding())

const fails = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fails.push(name)
}
const depth = () => page.evaluate(() => window.__nav.getState().stacks[window.__nav.getState().tab].length)
const push = async () => {
  // Pop and push in separate frames: doing both in one leaves the outgoing
  // screen mid-exit, which is not a state any real gesture can produce.
  await page.evaluate(() => {
    window.__nav.getState().switchTab('train')
    window.__nav.getState().popToRoot()
  })
  await page.waitForTimeout(420)
  await page.evaluate(() => window.__nav.getState().push('history'))
  await page.waitForTimeout(450)
}

/** Drag from the left edge to `toX` over `steps` moves spaced `gap` ms apart. */
async function swipe(toX, steps, gap) {
  await page.mouse.move(4, 420)
  await page.mouse.down()
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(4 + ((toX - 4) * i) / steps, 420)
    if (gap) await page.waitForTimeout(gap)
  }
  await page.mouse.up()
  await page.waitForTimeout(600)
}

const CASES = [
  ['a fast flick from a tenth of the way pops', 44, 6, 0, true],
  ['a slow drag a tenth of the way springs back', 44, 10, 40, false],
  ['a slow drag past a third of the way pops', 240, 12, 40, true],
  ['a slow drag to a quarter springs back', 96, 10, 40, false],
  ['a full slow drag pops', 380, 14, 30, true],
]

for (const [name, toX, steps, gap, shouldPop] of CASES) {
  await push()
  const before = await depth()
  await swipe(toX, steps, gap)
  const after = await depth()
  check(name, shouldPop ? after === before - 1 : after === before, `depth ${before} -> ${after}`)
}

/* A pull back toward the edge must cancel even past the distance threshold. */
await push()
{
  const before = await depth()
  await page.mouse.move(4, 420)
  await page.mouse.down()
  for (let i = 1; i <= 10; i += 1) { await page.mouse.move(4 + 26 * i, 420); await page.waitForTimeout(30) }
  for (let i = 1; i <= 5; i += 1) { await page.mouse.move(264 - 40 * i, 420); await page.waitForTimeout(6) }
  await page.mouse.up()
  await page.waitForTimeout(600)
  check('a flick back toward the edge cancels', (await depth()) === before, `depth ${before}`)
}

/* A vertical drag from the edge must scroll, not navigate. */
await push()
{
  const before = await depth()
  await page.mouse.move(6, 300)
  await page.mouse.down()
  for (let i = 1; i <= 8; i += 1) { await page.mouse.move(8, 300 - 18 * i); await page.waitForTimeout(16) }
  await page.mouse.up()
  await page.waitForTimeout(500)
  check('a vertical drag from the edge does not navigate', (await depth()) === before)
}

/* Nothing left behind: after a pop the screen must not still be offset. */
await push()
await swipe(380, 14, 25)
const resting = await page.evaluate(() => {
  const stack = document.querySelector('[data-stack-active="true"]')
  return [...stack.children].map((el) => ({
    tag: el.tagName.toLowerCase(),
    cls: (el.className || '').toString().slice(0, 20),
    left: Math.round(el.getBoundingClientRect().left),
    w: Math.round(el.getBoundingClientRect().width),
    screens: el.querySelectorAll('.scroll').length,
  }))
})
const offset = resting.filter((el) => el.screens > 0 && el.left !== 0)
check('the surviving screen rests at the left edge', offset.length === 0,
  JSON.stringify(resting))

/* And the root screen must not be swipeable at all. */
await page.evaluate(() => { window.__nav.getState().switchTab('train'); window.__nav.getState().popToRoot() })
await page.waitForTimeout(400)
const rootDepth = await depth()
await swipe(380, 12, 25)
check('the root of a tab cannot be swiped away', (await depth()) === rootDepth)

await browser.close()
await server.close()
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nAll gesture checks passed.')
process.exit(fails.length ? 1 : 0)
