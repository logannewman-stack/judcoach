// Serves the production build, installs the service worker, then cuts the
// network and reloads. `npm run offline`
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = new URL('../dist/', import.meta.url).pathname
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml' }

const requested = new Set()
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  const file = join(ROOT, path === '/' ? 'index.html' : path)
  requested.add(path)
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})
await new Promise((r) => server.listen(5196, r))
const url = 'http://localhost:5196/'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const fails = []
const missing = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fails.push(name)
}
page.on('response', (r) => { if (r.status() === 404) missing.push(new URL(r.url()).pathname) })

await page.goto(url, { waitUntil: 'networkidle' })
check('the built app loads', await page.evaluate(() => document.body.innerText.length > 80))
check('nothing 404s', missing.length === 0, missing.join(', '))

/* every asset the head references must exist */
const head = await page.evaluate(() =>
  [...document.querySelectorAll('link[href]')].map((l) => ({ rel: l.rel, href: l.getAttribute('href') })))
const heads = await Promise.all(head.map(async (h) => {
  const r = await page.request.get(new URL(h.href, url).href)
  return { ...h, status: r.status() }
}))
const broken = heads.filter((h) => h.status >= 400)
check('every icon and launch image resolves', broken.length === 0,
  broken.map((b) => `${b.href} ${b.status}`).join(', '))
check('a launch image is declared for the common iPhones',
  heads.filter((h) => h.rel === 'apple-touch-startup-image').length >= 10,
  String(heads.filter((h) => h.rel === 'apple-touch-startup-image').length))

const manifest = await (await page.request.get(new URL('./manifest.webmanifest', url).href)).json()
check('the manifest is standalone and portrait',
  manifest.display === 'standalone' && manifest.orientation === 'portrait')
check('the launch colour matches the launch image', manifest.background_color === '#111113',
  manifest.background_color)

/* the worker installs and precaches this build's assets */
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 })
  .catch(() => {})
const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration()
  const keys = await caches.keys()
  const cache = await caches.open(keys[0])
  const cached = (await cache.keys()).map((r) => new URL(r.url).pathname)
  return { active: !!reg?.active, keys, cached }
})
check('the service worker activates', sw.active)
check('its cache name is stamped with the build', /^grit-[0-9a-f]{12}$/.test(sw.keys[0] ?? ''),
  sw.keys.join(', '))
check('the shell and this build\'s assets are precached',
  sw.cached.some((p) => p.endsWith('index.html'))
  && sw.cached.some((p) => p.endsWith('.js'))
  && sw.cached.some((p) => p.endsWith('.css')),
  sw.cached.join(', '))

/* now cut the network entirely */
await ctx.setOffline(true)
const offlineErrors = []
page.on('pageerror', (e) => offlineErrors.push(String(e)))
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(900)
const offline = await page.evaluate(() => ({
  text: document.body.innerText.length,
  tabs: document.querySelectorAll('[role="tab"], .tabbar button').length,
  crashed: document.body.innerText.includes('Something went wrong'),
}))
check('the app still boots with no network', offline.text > 80 && !offline.crashed,
  JSON.stringify(offline))
check('the tab bar is there offline', offline.tabs >= 5, String(offline.tabs))

/* and can still be used */
await page.evaluate(() => window.__nav?.getState().switchTab('train'))
await page.waitForTimeout(300)
const usable = await page.evaluate(() => document.body.innerText.includes('Sessions')
  || document.body.innerText.includes('Train'))
check('navigation works offline', usable)
check('no page errors offline', offlineErrors.length === 0, offlineErrors.slice(0, 2).join(' | '))

await browser.close()
server.close()
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nAll offline checks passed.')
process.exit(fails.length ? 1 : 0)
