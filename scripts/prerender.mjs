// Writes real HTML for the pages a crawler arrives at first.
//
// The site renders in the browser, so every route is served the same empty
// document with a boot screen in it. Google runs JavaScript and gets there in
// the end; most other crawlers — and every link preview — do not. So after the
// build, each of these routes is opened in a real browser and the rendered page
// is written to dist-site/<route>/index.html, which the host serves in place of
// the shell. React still mounts and takes over, exactly as before.
//
// Component and block pages are left out on purpose: there are 640 of them, the
// sitemap already lists them, and the build would grow by several minutes.
//
//   npm run build && npm run prerender
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist-site')

// The pages someone can land on from a search result or a shared link. Left
// out: /composer and /playground (canvases), /saved (a personal list kept in
// the browser), /proving-ground (a benchmark that runs on arrival).
const ROUTES = [
  '/',
  '/getting-started',
  '/components',
  '/blocks',
  '/templates',
  '/recipes',
  '/integrations',
  '/foundations',
  '/tokens',
  '/themes',
  '/atlas',
  '/agents',
  '/changelog',
  '/built-with',
  '/migrate',
  '/find',
]

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.woff2': 'font/woff2',
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('prerender: no dist-site/index.html — run `npm run build` first')
  process.exit(1)
}

// The built site, served the way Cloudflare's static assets serve it: the file
// at that exact path, else <path>/index.html, else the shell. Matching the host
// matters — a server that skipped the middle rule would hand every prerendered
// route the shell instead, and this script would be measuring nothing.
function resolve(path) {
  const exact = join(DIST, path)
  if (extname(exact) && existsSync(exact)) return exact
  const directory = join(DIST, path, 'index.html')
  if (existsSync(directory)) return directory
  return join(DIST, 'index.html')
}

const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  try {
    const file = resolve(path)
    const body = await readFile(file)
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'text/html; charset=utf-8' })
    response.end(body)
  } catch {
    response.writeHead(404).end('not found')
  }
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`

const { chromium } = await import('playwright')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

let written = 0
const failures = []

for (const route of ROUTES) {
  try {
    await page.goto(`${origin}${route}`, { waitUntil: 'networkidle', timeout: 60_000 })
    // The shell is replaced on React's first render; a heading means the page
    // itself — not the skeleton behind it — is what gets written.
    await page.waitForSelector('main h1, main h2', { timeout: 30_000 })
    await page.waitForFunction(() => !document.querySelector('.boot'), undefined, { timeout: 30_000 })

    const html = await page.evaluate(() => {
      // The router's own scroll and focus state has no meaning in a file.
      for (const node of document.querySelectorAll('[data-prerender-strip]')) node.remove()
      return `<!doctype html>\n${document.documentElement.outerHTML}`
    })

    if (!/<main[\s>]/.test(html)) throw new Error('no <main> in the captured html')

    const directory = route === '/' ? DIST : join(DIST, route)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'index.html'), html)
    written++
    console.log(`  ${route.padEnd(18)} ${(Buffer.byteLength(html) / 1024).toFixed(0)} kB`)
  } catch (error) {
    failures.push(`${route}: ${error.message.split('\n')[0]}`)
  }
}

await browser.close()
server.close()

console.log(`prerender: ${written}/${ROUTES.length} pages written`)
if (failures.length) {
  for (const failure of failures) console.error(`::error::prerender ${failure}`)
  process.exit(1)
}
