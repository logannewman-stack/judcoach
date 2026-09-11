// Verifies the two ways a client can end up stuck: a damaged import, and a
// render that throws on already-persisted data. `npm run recover`
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ server: { port: 5198 } })
await server.listen()
// Vite falls back to another port when this one is taken, and does it silently,
// so the address has to come back out of the server rather than be assumed —
// six agents verifying at once would otherwise all drive the first one's app.
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5198/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const fails = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fails.push(name)
}
const boot = async () => {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__store, null, { timeout: 15000 })
}

await boot()

/* ---- 1. a file that isn't an export at all is refused ---- */
const notOurs = await page.evaluate(() =>
  window.__store.getState().importState({ hello: 'world', items: [1, 2, 3] }))
check('a foreign JSON file is refused', notOurs.ok === false, notOurs.reason)

const notObject = await page.evaluate(() => window.__store.getState().importState('[]'))
check('a string is refused', notObject.ok === false)

/* ---- 2. a damaged export imports what it can and reports the rest ---- */
const damaged = await page.evaluate(() => {
  const before = window.__store.getState().logs.length
  const result = window.__store.getState().importState({
    profile: { name: 'Jud', units: 'stone', heightIn: '71', trainingMaxes: 'nope',
               availablePlates: [45, 'x', -10, 25], goalWeight: null },
    settings: { theme: 'dark', broken: { fn: {} } },
    weighIns: [
      null,
      { date: '2026-01-02', weight: 201 },
      { date: 'not-a-date', weight: 200 },
      { date: '2026-01-03', weight: 'heavy' },
      { date: '2026-01-04', weight: 99999 },
      { date: '2026-01-05', weight: '198.5' },
    ],
    measurements: [{ date: '2026-01-02', waist: '34', chest: null }],
    photos: [{ date: '2026-01-02', dataUrl: 'https://evil.example/x.png', pose: 'front' },
             { date: '2026-01-03', dataUrl: 'data:image/png;base64,AAA', pose: 'sideways' }],
    logs: [
      {},
      { date: '2026-01-02', exercises: null },
      { date: '2026-01-03', exercises: [{ exerciseId: 'back-squat', sets: [{ weight: 315, reps: 3, rpe: 8 }] }] },
      { date: '2026-01-04', exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 'x', reps: 0 }] }] },
    ],
    checkIns: [{ date: '2026-01-02', weight: 201, sleep: 4 }, 'junk'],
    nutrition: { '2026-01-02': { waterOz: '64', checked: { a: true, b: 'yes' }, portions: { x: 99 } },
                 'nope': {} },
  })
  const s = window.__store.getState()
  return {
    result,
    before,
    units: s.profile.units,
    height: s.profile.heightIn,
    maxes: typeof s.profile.trainingMaxes,
    plates: s.profile.availablePlates,
    goalWeight: s.profile.goalWeight,
    weighIns: s.weighIns.map((w) => `${w.date}:${w.weight}`),
    photos: s.photos.map((p) => p.pose),
    logs: s.logs.map((l) => l.date),
    waist: s.measurements[0]?.waist,
    water: s.nutrition['2026-01-02']?.waterOz,
    checkedKeys: Object.keys(s.nutrition['2026-01-02']?.checked ?? {}),
    portionKeys: Object.keys(s.nutrition['2026-01-02']?.portions ?? {}),
    days: Object.keys(s.nutrition),
    active: s.active,
  }
})
check('a damaged export still imports', damaged.result.ok === true)
check('bad units fall back to the default', damaged.units === 'lb', damaged.units)
check('a quoted number is coerced', damaged.height === 71, String(damaged.height))
check('a non-object trainingMaxes becomes an object', damaged.maxes === 'object')
check('junk plates are dropped and sorted', JSON.stringify(damaged.plates) === '[45,25]',
  JSON.stringify(damaged.plates))
check('a null number keeps the default', typeof damaged.goalWeight === 'number' && damaged.goalWeight > 0,
  String(damaged.goalWeight))
check('only valid weigh-ins land', JSON.stringify(damaged.weighIns) === '["2026-01-05:198.5","2026-01-02:201"]',
  JSON.stringify(damaged.weighIns))
check('a remote photo src is rejected', JSON.stringify(damaged.photos) === '["front"]',
  JSON.stringify(damaged.photos))
check('an unknown pose falls back to front', damaged.photos[0] === 'front')
check('only logs with real sets land', JSON.stringify(damaged.logs) === '["2026-01-03"]',
  JSON.stringify(damaged.logs))
check('a quoted measurement is coerced', damaged.waist === 34, String(damaged.waist))
check('a quoted waterOz is coerced', damaged.water === 64, String(damaged.water))
check('a non-true checked value is dropped', JSON.stringify(damaged.checkedKeys) === '["a"]',
  JSON.stringify(damaged.checkedKeys))
check('an absurd portion is dropped', damaged.portionKeys.length === 0, JSON.stringify(damaged.portionKeys))
check('a non-date nutrition key is dropped', JSON.stringify(damaged.days) === '["2026-01-02"]',
  JSON.stringify(damaged.days))
check('an in-flight session is not carried across', damaged.active === null)
check('the skipped count is reported',
  (damaged.result.dropped.workouts ?? 0) === 3 && (damaged.result.dropped['weigh-ins'] ?? 0) === 4,
  JSON.stringify(damaged.result.dropped))

/* ---- 3. every screen still renders on the imported data ---- */
const ROUTES = [['today', 'today'], ['train', 'train'], ['train', 'history'], ['train', 'prs'],
                ['meals', 'meals'], ['weigh', 'weigh'], ['weigh', 'photos'], ['weigh', 'checkIns'],
                ['settings', 'settings'], ['settings', 'dataSettings']]
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
for (const [tab, key] of ROUTES) {
  await page.evaluate(([t, k]) => {
    window.__nav.getState().switchTab(t)
    if (k !== t) window.__nav.getState().push(k)
  }, [tab, key])
  await page.waitForTimeout(160)
}
check('every screen renders on the repaired data', errors.length === 0, errors.slice(0, 2).join(' | '))

/* ---- 4. a round trip loses nothing ---- */
const roundTrip = await page.evaluate(() => {
  window.__store.getState().resetToSeed()
  const s = window.__store.getState()
  const before = { weighIns: s.weighIns.length, logs: s.logs.length, sets: s.logs.reduce((n, l) =>
    n + l.exercises.reduce((m, e) => m + e.sets.length, 0), 0), maxes: Object.keys(s.profile.trainingMaxes).length }
  const result = window.__store.getState().importState(JSON.parse(window.__exportSnapshot()))
  const a = window.__store.getState()
  return { before, result, after: { weighIns: a.weighIns.length, logs: a.logs.length,
    sets: a.logs.reduce((n, l) => n + l.exercises.reduce((m, e) => m + e.sets.length, 0), 0),
    maxes: Object.keys(a.profile.trainingMaxes).length } }
})
check('a real export round-trips intact',
  JSON.stringify(roundTrip.before) === JSON.stringify(roundTrip.after)
    && Object.keys(roundTrip.result.dropped).length === 0,
  `${JSON.stringify(roundTrip.before)} vs ${JSON.stringify(roundTrip.after)} dropped=${JSON.stringify(roundTrip.result.dropped)}`)

/* ---- 5. a persisted blob whose collections are not collections stays usable ---- */
// Wait out the debounce first, or the pending flush overwrites the poison.
await page.waitForTimeout(700)
await page.evaluate(() => {
  // Written straight into storage, past the import validator — the shape a
  // pre-validation build could already have saved, or a hand-edited file.
  const blob = JSON.parse(localStorage.getItem('grit-store-v1'))
  blob.state.logs = {}
  blob.state.weighIns = 'nope'
  blob.state.nutrition = []
  blob.state.profile = 'Jud'
  blob.state.active = 7
  localStorage.setItem('grit-store-v1', JSON.stringify(blob))
})
const poisoned = []
page.on('pageerror', (e) => poisoned.push(String(e)))
await boot()
for (const [tab, key] of ROUTES) {
  await page.evaluate(([t, k]) => {
    window.__nav.getState().switchTab(t)
    if (k !== t) window.__nav.getState().push(k)
  }, [tab, key])
  await page.waitForTimeout(140)
}
const guarded = await page.evaluate(() => {
  const s = window.__store.getState()
  return {
    logs: Array.isArray(s.logs) ? s.logs.length : 'not an array',
    weighIns: Array.isArray(s.weighIns) ? s.weighIns.length : 'not an array',
    nutrition: Array.isArray(s.nutrition) ? 'array' : typeof s.nutrition,
    units: s.profile?.units,
    maxes: typeof s.profile?.trainingMaxes,
    active: s.active,
    crashed: document.body.innerText.includes('Something went wrong'),
  }
})
check('a non-array collection becomes empty, not the sample data',
  guarded.logs === 0 && guarded.weighIns === 0, JSON.stringify(guarded))
check('a non-object nutrition becomes an object', guarded.nutrition === 'object')
check('a non-object profile falls back to the defaults',
  guarded.units === 'lb' && guarded.maxes === 'object', `${guarded.units}/${guarded.maxes}`)
check('a junk active session becomes null', guarded.active === null)
check('every screen still renders', poisoned.length === 0 && !guarded.crashed,
  poisoned.slice(0, 2).join(' | '))

/* ---- 6. a render that throws lands on the recovery screen, not a blank page ---- */
const boundary = await page.evaluate(async () => {
  // Bare specifiers don't resolve inside evaluate; Vite's pre-bundled deps do.
  const [react, domClient, { ErrorBoundary }] = await Promise.all([
    import('/node_modules/.vite/deps/react.js'),
    import('/node_modules/.vite/deps/react-dom_client.js'),
    import('/src/components/ErrorBoundary.tsx'),
  ])
  const createElement = react.createElement ?? react.default.createElement
  const createRoot = domClient.createRoot ?? domClient.default.createRoot
  const host = document.createElement('div')
  document.body.appendChild(host)
  const Boom = () => { throw new Error('programme week 9 does not exist') }
  const root = createRoot(host)
  const quiet = console.error
  console.error = () => {}
  root.render(createElement(ErrorBoundary, null, createElement(Boom)))
  await new Promise((r) => setTimeout(r, 200))
  console.error = quiet

  const out = {
    heading: host.innerText.includes('Something went wrong'),
    buttons: [...host.querySelectorAll('button')].map((b) => b.textContent),
    detail: host.innerHTML.includes('programme week 9 does not exist'),
    blank: host.innerText.trim().length === 0,
    small: [...host.querySelectorAll('button')]
      .filter((b) => b.getBoundingClientRect().height < 44).length,
  }

  // "Try again" re-renders the child; a second failure stops offering it.
  console.error = () => {}
  for (let i = 0; i < 3; i += 1) {
    const retry = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Try again')
    if (!retry) break
    retry.click()
    await new Promise((r) => setTimeout(r, 80))
  }
  console.error = quiet
  out.retryGivesUp = ![...host.querySelectorAll('button')]
    .some((b) => b.textContent === 'Try again')
  out.stillRecoverable = [...host.querySelectorAll('button')]
    .some((b) => b.textContent === 'Reset app data')

  root.unmount()
  host.remove()
  return out
})
check('a throwing render shows a recovery screen, not a blank page',
  boundary.heading && !boundary.blank, JSON.stringify(boundary))
check('it offers a data copy', boundary.buttons.some((b) => /Save a copy/.test(b)),
  JSON.stringify(boundary.buttons))
check('it offers a retry', boundary.buttons.includes('Try again'))
check('it offers a reset', boundary.buttons.includes('Reset app data'))
check('it shows the underlying error', boundary.detail)
check('every control on it is tappable', boundary.small === 0, `${boundary.small} under 44pt`)
check('a retry that keeps failing stops offering itself', boundary.retryGivesUp)
check('reset is still reachable after retries', boundary.stillRecoverable)

/* ---- 7. pressing Reset really does clear the keys and relaunch ---- */
await page.waitForTimeout(700)
await page.evaluate(() => {
  localStorage.setItem('grit-store-v1', '{"poison":1}')
  localStorage.setItem('grit-photos-v1', '[1]')
})
// The click calls location.reload(), so this evaluate is cut off by the
// navigation — that is the pass condition, not a failure.
await page.evaluate(async () => {
  const [react, domClient, { ErrorBoundary }] = await Promise.all([
    import('/node_modules/.vite/deps/react.js'),
    import('/node_modules/.vite/deps/react-dom_client.js'),
    import('/src/components/ErrorBoundary.tsx'),
  ])
  const createElement = react.createElement ?? react.default.createElement
  const createRoot = domClient.createRoot ?? domClient.default.createRoot
  const host = document.createElement('div')
  host.id = 'recovery-host'
  document.body.appendChild(host)
  const Boom = () => { throw new Error('boom') }
  console.error = () => {}
  createRoot(host).render(createElement(ErrorBoundary, null, createElement(Boom)))
}).catch(() => {})
await page.waitForTimeout(200)
await page.evaluate(() => {
  document.querySelector('#recovery-host button:last-of-type')
  ;[...document.querySelectorAll('#recovery-host button')]
    .find((b) => b.textContent === 'Reset app data')?.click()
}).catch(() => {})
await page.waitForFunction(() => !!window.__store, null, { timeout: 15000 })
await page.waitForTimeout(500)
const afterReset = await page.evaluate(() => ({
  poisoned: (localStorage.getItem('grit-store-v1') ?? '').includes('poison'),
  photoKey: localStorage.getItem('grit-photos-v1'),
  renders: document.body.innerText.length > 80,
  crashed: document.body.innerText.includes('Something went wrong'),
}))
check('reset clears the poisoned blob', afterReset.poisoned === false)
check('reset clears the photo key', afterReset.photoKey === null || afterReset.photoKey === '[]')
check('the client can reset their way back into the app',
  afterReset.renders && !afterReset.crashed, JSON.stringify(afterReset))

await browser.close()
await server.close()
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nAll recovery checks passed.')
process.exit(fails.length ? 1 : 0)
