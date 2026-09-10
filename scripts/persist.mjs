// Verifies the persistence layer: migration, deep merge, debounce, page-hide
// flush, quota tolerance, and the separate photo key. `npm run persist`
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ server: { port: 5199 } })
await server.listen()
const url = 'http://localhost:5199/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const fails = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fails.push(name)
}

/* ---- 1. a v1 blob with photos inside migrates to the separate key ---- */
await page.goto(url)
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('grit-store-v1', JSON.stringify({
    version: 1,
    state: {
      profile: { name: 'Jud', units: 'lb' },           // deliberately partial
      settings: { theme: 'dark' },                      // deliberately partial
      photos: [{ id: 'p1', date: '2026-01-01', dataUrl: 'data:image/png;base64,AAA', weight: 200 }],
      weighIns: [{ id: 'w1', date: '2026-01-02', weight: 201 }],
    },
  }))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__store, null, { timeout: 15000 })

const afterMigrate = await page.evaluate(() => {
  const s = window.__store.getState()
  return {
    photos: s.photos.length,
    photoKey: JSON.parse(localStorage.getItem('grit-photos-v1') || 'null')?.length ?? 0,
    mainBlobHasPhotos: 'photos' in (JSON.parse(localStorage.getItem('grit-store-v1')).state ?? {}),
    version: JSON.parse(localStorage.getItem('grit-store-v1')).version,
    name: s.profile.name,
    rounding: s.profile.roundingIncrement,
    plates: Array.isArray(s.profile.availablePlates) ? s.profile.availablePlates.length : null,
    theme: s.settings.theme,
    notif: s.settings.notifications && typeof s.settings.notifications === 'object'
      ? Object.keys(s.settings.notifications).length : 0,
    weighIns: s.weighIns.length,
  }
})
check('migrated photo reaches state', afterMigrate.photos === 1)
check('migrated photo lives in its own key', afterMigrate.photoKey === 1)
check('photos no longer ride the main blob', afterMigrate.mainBlobHasPhotos === false)
check('version bumped to 2', afterMigrate.version === 2, String(afterMigrate.version))
check('persisted profile field survives', afterMigrate.name === 'Jud')
check('missing profile field filled from defaults',
  typeof afterMigrate.rounding === 'number' && afterMigrate.plates > 0,
  `rounding=${afterMigrate.rounding} plates=${afterMigrate.plates}`)
check('persisted settings field survives', afterMigrate.theme === 'dark')
check('nested notifications filled from defaults', afterMigrate.notif > 0, String(afterMigrate.notif))
check('persisted array survives', afterMigrate.weighIns === 1)

/* ---- 2. debounced writes survive a reload ---- */
await page.evaluate(() => {
  window.__store.getState().saveWeighIn({ id: 'w-2026-02-02', date: '2026-02-02', weight: 197.5 })
})
const immediate = await page.evaluate(
  () => JSON.parse(localStorage.getItem('grit-store-v1')).state.weighIns.length)
check('write is debounced, not synchronous', immediate === 1, `wrote ${immediate}`)
await page.waitForTimeout(700)
const flushed = await page.evaluate(
  () => JSON.parse(localStorage.getItem('grit-store-v1')).state.weighIns.length)
check('debounced write lands', flushed === 2, `wrote ${flushed}`)

/* ---- 3. a read before the flush sees the unflushed value ---- */
const readThrough = await page.evaluate(() => {
  window.__store.getState().saveWeighIn({ id: 'w-2026-02-03', date: '2026-02-03', weight: 196 })
  const raw = window.__store.persist.getOptions().storage.getItem('grit-store-v1')
  return raw?.state?.weighIns?.length ?? -1
})
check('read sees unflushed write', readThrough === 3, String(readThrough))

/* ---- 4. hiding the page flushes immediately ---- */
await page.evaluate(() => {
  window.__store.getState().saveWeighIn({ id: 'w-2026-02-04', date: '2026-02-04', weight: 195 })
  document.dispatchEvent(new Event('visibilitychange'))
})
const onHide = await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
  return JSON.parse(localStorage.getItem('grit-store-v1')).state.weighIns.length
})
check('page-hide flushes pending writes', onHide === 4, String(onHide))

/* ---- 5. a full disk warns instead of throwing into the component ---- */
const quota = await page.evaluate(async () => {
  const real = localStorage.setItem.bind(localStorage)
  localStorage.setItem = () => { throw new DOMException('full', 'QuotaExceededError') }
  let threw = false
  try { window.__store.getState().saveWeighIn({ id: 'w-2026-02-05', date: '2026-02-05', weight: 194 }) }
  catch { threw = true }
  await new Promise((r) => setTimeout(r, 700))
  const toastText = document.querySelector('.toast')?.textContent ?? ''
  localStorage.setItem = real
  return { threw, toastText, stateKept: window.__store.getState().weighIns.length }
})
check('quota error does not reach the caller', quota.threw === false)
check('quota warns the client', /Storage full/i.test(quota.toastText), JSON.stringify(quota.toastText))
check('in-memory state is kept after a failed write', quota.stateKept === 5, String(quota.stateKept))

/* ---- 6. photos are written on their own schedule, not the state hot path ---- */
const photoSplit = await page.evaluate(async () => {
  const before = localStorage.getItem('grit-store-v1').length
  window.__store.getState().addPhoto({
    id: 'p2', date: '2026-03-01', dataUrl: `data:image/png;base64,${'Q'.repeat(40000)}`, weight: 190,
  })
  await new Promise((r) => setTimeout(r, 1400))
  return {
    mainGrowth: localStorage.getItem('grit-store-v1').length - before,
    photoKey: JSON.parse(localStorage.getItem('grit-photos-v1')).length,
  }
})
check('a 40 kB photo does not grow the state blob', photoSplit.mainGrowth < 200, `+${photoSplit.mainGrowth} bytes`)
check('photo lands in the photo key', photoSplit.photoKey === 2, String(photoSplit.photoKey))

await page.reload({ waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__store, null, { timeout: 15000 })
const survived = await page.evaluate(() => ({
  photos: window.__store.getState().photos.length,
  weighIns: window.__store.getState().weighIns.length,
}))
check('photos rehydrate from their own key', survived.photos === 2, String(survived.photos))
check('state survives the reload', survived.weighIns === 5, String(survived.weighIns))

const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.waitForTimeout(300)
check('no console errors', errors.length === 0, errors.join(' | '))

await browser.close()
await server.close()
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nAll persistence checks passed.')
process.exit(fails.length ? 1 : 0)
