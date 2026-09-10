// Visits every registered screen and reports console errors + a screenshot grid.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = process.argv[2] ?? '/tmp/walk'
const scheme = process.argv[3] ?? 'light'
mkdirSync(OUT, { recursive: true })

const ROUTES = [
  ['today', 'today', null],
  ['train', 'train', null],
  ['train', 'session', { weekIndex: 5, sessionId: 'w5-lowerA' }],
  ['train', 'history', null],
  ['train', 'logDetail', 'FIRST_LOG'],
  ['train', 'exerciseLibrary', null],
  ['train', 'exerciseDetail', { exerciseId: 'back-squat' }],
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
  ['settings', 'profileSettings', null],
  ['settings', 'trainingMaxes', null],
  ['settings', 'equipment', null],
  ['settings', 'appearance', null],
  ['settings', 'workoutSettings', null],
  ['settings', 'notifications', null],
  ['settings', 'dataSettings', null],
  ['settings', 'coach', null],
  ['settings', 'programSettings', null],
  ['settings', 'install', null],
]

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  colorScheme: scheme,
})
const page = await ctx.newPage()
const problems = []
page.on('console', (m) => { if (m.type() === 'error') problems.push(`[console] ${m.text()}`) })
page.on('pageerror', (e) => problems.push(`[pageerror] ${String(e)}`))

await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5177/', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

// A fresh context lands on onboarding, which would cover every screen below.
await page.evaluate(() => window.__store.getState().completeOnboarding())
await page.waitForTimeout(500)

// WIPE=1 walks the app with every log, weigh-in and photo cleared, which is
// where empty states and divide-by-zero maths tend to surface.
if (process.env.WIPE === '1') {
  await page.evaluate(() => window.__store.getState().clearAllData())
  await page.waitForTimeout(500)
}

for (const [tab, key, rawParams] of ROUTES) {
  const before = problems.length
  await page.evaluate(({ tab, key, rawParams }) => {
    const nav = window.__nav
    const st = nav.getState()
    st.dismiss()
    // reset to the tab root first so each route is reached cleanly
    nav.setState({ tab, stacks: { ...st.stacks, [tab]: [st.stacks[tab][0]] } })
    if (key === tab) return
    let params = rawParams
    if (rawParams === 'FIRST_LOG') {
      const store = JSON.parse(localStorage.getItem('grit-store-v1') ?? '{}')
      params = { logId: store?.state?.logs?.[store.state.logs.length - 1]?.id }
    }
    if (rawParams === 'MEAL') params = { mealId: 'meal-3', date: new Date().toISOString().slice(0, 10) }
    nav.getState().push(key, params ?? undefined)
  }, { tab, key, rawParams })
  await page.waitForTimeout(620)
  await page.screenshot({ path: `${OUT}/${key}.png` })
  const newProblems = problems.slice(before)
  const rendered = await page.evaluate(() => {
    const el = document.querySelector('.screen')
    return (document.body.innerText ?? '').trim().length > 20 && !!el
  })
  console.log(
    `${rendered ? 'ok  ' : 'EMPTY'} ${key.padEnd(18)}${newProblems.length ? ' <- ' + newProblems.join(' | ') : ''}`,
  )
}

// Full-screen runner is presented, not pushed.
await page.evaluate(() => window.__nav.getState().present('runner', { weekIndex: 5, sessionId: 'w5-upperA' }))
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/runner.png` })
console.log(`ok   runner`)

console.log(problems.length ? `\nTOTAL PROBLEMS: ${problems.length}` : '\nNo console errors across any screen.')
await browser.close()
