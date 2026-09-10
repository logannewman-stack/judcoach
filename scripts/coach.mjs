// Drives both seats of the conversation: Jud comments on a real session, the
// client sees it unread, replies, and Jud sees that. `npm run coach`
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ server: { port: 5190 } })
await server.listen()
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const fails = []
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fails.push(name)
}

await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__store, null, { timeout: 20000 })
await page.evaluate(() => window.__store.getState().completeOnboarding())

const seat = (who) => page.evaluate(async (w) =>
  (await import('/src/store/coach.ts')).useCoach.getState().setViewAs(w), who)
const state = () => page.evaluate(async () => {
  const { useCoach } = await import('/src/store/coach.ts')
  const { unreadFrom } = await import('/src/domain/coach.ts')
  const s = useCoach.getState()
  return {
    viewAs: s.viewAs,
    total: s.notes.length,
    unread: unreadFrom(s.notes, s.viewAs).length,
    last: s.notes.at(-1),
  }
})
const openThread = async () => {
  await page.evaluate(() => {
    window.__nav.getState().switchTab('settings')
    window.__nav.getState().popToRoot()
  })
  await page.waitForTimeout(300)
  await page.evaluate(() => window.__nav.getState().push('messages'))
  await page.waitForTimeout(700)
}

/* ---- 1. the client starts with unread messages from Jud ---- */
{
  const s = await state()
  check('the client opens with unread messages from Jud', s.viewAs === 'client' && s.unread > 0,
    `${s.unread} unread of ${s.total}`)
  const badge = await page.evaluate(() =>
    document.querySelector('.tab[data-active] ~ .tab .tab-badge, .tabbar .tab-badge')?.textContent ?? null)
  check('the tab bar carries the count', badge != null, String(badge))
}

/* ---- 2. opening the thread reads them, and the divider marks where ---- */
await openThread()
{
  const seen = await page.evaluate(() => ({
    divider: !!document.querySelector('.thread-new'),
    title: document.querySelector('[data-stack-active="true"] > div:last-of-type .navbar-title')?.textContent
      ?? [...document.querySelectorAll('.navbar-title')].at(-1)?.textContent ?? '',
  }))
  check('a New divider marks where the client left off', seen.divider)
  check('the thread is titled with the other person', /Jud/.test(seen.title), seen.title)
  await page.waitForTimeout(400)
  const s = await state()
  check('opening the thread marks it read', s.unread === 0, `${s.unread} left`)
  const badge = await page.evaluate(() => document.querySelector('.tabbar .tab-badge'))
  check('the tab badge clears', badge === null)
}

/* ---- 3. the client replies ---- */
{
  const before = (await state()).total
  await page.fill('.screen-footer .compose-field', 'Straps arrived, will use them Thursday.')
  await page.click('.screen-footer .compose-send')
  await page.waitForTimeout(600)
  const s = await state()
  check('the client can send', s.total === before + 1 && s.last.author === 'client',
    `${s.last?.author}`)
  const sides = await page.evaluate(() => {
    const g = [...document.querySelectorAll('.msg-group')].at(-1)
    return g?.getAttribute('data-from')
  })
  check("the client's own message is outgoing", sides === 'me', String(sides))
}

/* ---- 4. Jud takes the seat, from the Coach screen the way a person would ---- */
await page.evaluate(() => {
  window.__nav.getState().switchTab('settings')
  window.__nav.getState().popToRoot()
  window.__nav.getState().push('coach')
})
await page.waitForTimeout(500)
await page.evaluate(() => {
  const sw = [...document.querySelectorAll('[role="switch"], input[type="checkbox"]')]
    .find((el) => /Reply as Jud/i.test(el.getAttribute('aria-label') ?? ''))
  sw?.click()
})
await page.waitForTimeout(700)
{
  const bar = await page.evaluate(() => document.querySelector('.seat-bar')?.textContent ?? '')
  check('the seat is unmistakable', /You are Jud/.test(bar), bar.slice(0, 60))
  const overlap = await page.evaluate(() => {
    const seatBar = document.querySelector('.seat-bar')?.getBoundingClientRect()
    const nav = document.querySelector('[data-stack-active="true"] .navbar')?.getBoundingClientRect()
    if (!seatBar || !nav) return 'missing'
    return Math.min(seatBar.bottom, nav.bottom) - Math.max(seatBar.top, nav.top)
  })
  check('it pushes the app down instead of covering it', typeof overlap === 'number' && overlap <= 0,
    String(overlap))
  const s = await state()
  check("Jud arrives with the client's messages unread", s.unread > 0, `${s.unread}`)

  await openThread()
  const sides = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('.msg-group')]
    const last = groups.at(-1)
    return { from: last?.getAttribute('data-from'), text: last?.textContent?.slice(0, 40) }
  })
  check("the client's message is incoming from Jud's seat", sides.from === 'them',
    `${sides.from}: ${sides.text}`)
}

/* ---- 5. Jud comments on a specific session ---- */
{
  const logId = await page.evaluate(() => {
    const log = window.__store.getState().logs[1]
    window.__nav.getState().switchTab('train')
    window.__nav.getState().popToRoot()
    window.__nav.getState().push('logDetail', { logId: log.id })
    return log.id
  })
  await page.waitForTimeout(700)
  await page.evaluate(() => document.querySelector('.note-strip')?.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(300)
  const label = await page.evaluate(() =>
    [...document.querySelectorAll('.note-strip button')].map((b) => b.textContent).join(' | '))
  check('the reply box on a record is addressed to the client', /Alex/.test(label), label)

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.note-strip button')].find((x) => /Alex/.test(x.textContent))
    b?.click()
  })
  await page.waitForTimeout(300)
  await page.fill('.note-strip .compose-field', 'Bar drifted forward on the third rep. Watch the setup.')
  await page.click('.note-strip .compose-send')
  await page.waitForTimeout(600)

  const s = await state()
  check('Jud can comment on one session', s.last.author === 'coach' && s.last.anchor.kind === 'workout',
    `${s.last?.author}/${s.last?.anchor?.kind}`)
  check('the comment is anchored to that session', s.last.anchor.id === logId, s.last?.anchor?.id)
}

/* ---- 6. back in the client's seat, it is waiting for them ---- */
await page.evaluate(() => {
  [...document.querySelectorAll('.seat-bar-exit')][0]?.click()
})
await page.waitForTimeout(700)
{
  const s = await state()
  check("the client sees Jud's new comment as unread", s.unread === 1, `${s.unread}`)
  const gone = await page.evaluate(() => document.querySelector('.seat-bar') === null)
  check('the seat bar goes away', gone)

  await openThread()
  const card = await page.evaluate(() =>
    [...document.querySelectorAll('.msg-card-title')].map((e) => e.textContent).at(-1) ?? '')
  check('the comment carries a card naming the session in the thread', card.length > 0, card)
  const opens = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button.msg-card')].at(-1)
    if (!b) return 'no card'
    b.click()
    return true
  })
  await page.waitForTimeout(700)
  const landed = await page.evaluate(() => window.__nav.getState().stacks.train.at(-1)?.key)
  check('the card opens the session it is about', opens === true && landed === 'logDetail',
    `${opens} / ${landed}`)
}

/* ---- 7. and it survives a reload ---- */
await page.reload({ waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__store, null, { timeout: 20000 })
await page.waitForTimeout(600)
{
  const s = await state()
  check('the conversation survives a reload', s.total > 8 && s.viewAs === 'client', `${s.total} messages`)
}

check('no console errors throughout', errors.length === 0, errors.slice(0, 2).join(' | '))

await browser.close()
await server.close()
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nAll coach checks passed.')
process.exit(fails.length ? 1 : 0)
