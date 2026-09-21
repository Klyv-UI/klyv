// Lays the product captures out as ten 4K marketing images.
//
// Each slide is written out as an HTML file in marketing/slides — so it can be
// opened, read and edited like any page — then photographed at exactly
// 3840 x 2160 into marketing/images. Every screenshot in them is a capture of
// the running product (see capture.mjs), and every figure is one the site
// itself reports: nothing is drawn to look like the product.
//
// Usage: node marketing/capture.mjs && node marketing/render.mjs
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SLIDES = join(HERE, 'slides')
const IMAGES = join(HERE, 'images')
mkdirSync(SLIDES, { recursive: true })
mkdirSync(IMAGES, { recursive: true })

/** The figures on the slides, as the site reports them. */
const FACTS = {
  components: 614,
  screens: 11,
  fresh: 71,
  showpieces: 21,
  dependencies: 2,
  contrast: '4.5:1',
  tools: 9,
  textUsers: 248,
}

const capture = (name) => `../captures/${name}.png`

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
  :root {
    --accent: #c8f24e; --accent-ink: #16200c;
    --ink: #edf0e8; --soft: #a3aa9b; --faint: #6f766a;
    --bg: #0b0d0a; --panel: #131711; --line: #262c22;
  }
  .light { --ink: #17191c; --soft: #5c6165; --faint: #7a8085; --bg: #f4f7f0; --panel: #ffffff; --line: #e3e5e3; }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 3840px; height: 2160px; overflow: hidden; }
  body {
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: var(--ink); background: var(--bg);
    position: relative; -webkit-font-smoothing: antialiased;
  }
  .glow { position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(60% 55% at 78% 45%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 70%),
                radial-gradient(40% 40% at 5% 110%, color-mix(in oklab, var(--accent) 12%, transparent), transparent 70%); }
  .dots { position: absolute; inset: 0; pointer-events: none; opacity: .55;
    background-image: radial-gradient(color-mix(in oklab, var(--ink) 10%, transparent) 2px, transparent 2.5px);
    background-size: 44px 44px; mask-image: radial-gradient(70% 70% at 60% 50%, #000 30%, transparent 85%); }
  .frame { position: absolute; inset: 0; padding: 150px 170px; display: flex; flex-direction: column; }
  .brand { position: absolute; left: 170px; bottom: 110px; display: flex; align-items: center; gap: 22px; font-weight: 800; font-size: 44px; letter-spacing: -.02em; }
  .mark { width: 72px; height: 72px; border-radius: 22px; background: var(--accent); color: var(--accent-ink); display: grid; place-items: center; font-size: 40px; }
  .install { position: absolute; right: 170px; bottom: 116px; font: 700 34px 'JetBrains Mono', monospace; color: var(--soft);
    border: 2px solid var(--line); border-radius: 999px; padding: 18px 36px; background: color-mix(in oklab, var(--panel) 80%, transparent); }
  .install b { color: var(--faint); font-weight: 700; }
  .eyebrow { display: inline-flex; align-items: center; gap: 18px; font-weight: 800; font-size: 30px; letter-spacing: .22em; text-transform: uppercase; color: var(--soft); }
  .eyebrow::before { content: ''; width: 16px; height: 16px; border-radius: 50%; background: var(--accent); }
  h1 { font-weight: 800; font-size: 148px; line-height: .98; letter-spacing: -.055em; margin-top: 44px; }
  h1 .quiet { color: var(--faint); }
  h1 .slab { background: var(--accent); color: var(--accent-ink); border-radius: .16em; padding: 0 .14em .04em; display: inline-block; transform: rotate(-1.5deg); }
  .lede { font-size: 46px; line-height: 1.45; font-weight: 500; color: var(--soft); margin-top: 48px; max-width: 30ch; }
  .points { list-style: none; padding: 0; margin-top: 60px; display: flex; flex-direction: column; gap: 30px; }
  .points li { font-size: 38px; font-weight: 600; display: flex; gap: 22px; align-items: baseline; }
  .points li::before { content: ''; flex: none; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); transform: translateY(-6px); }
  .points small { display: block; font-size: 30px; font-weight: 500; color: var(--faint); margin-top: 8px; }
  .shot { border-radius: 44px; overflow: hidden; border: 3px solid var(--line); background: var(--panel);
    box-shadow: 0 60px 160px -40px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.03); }
  .shot img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .split { display: grid; grid-template-columns: 1040px 1fr; gap: 130px; align-items: center; flex: 1; }
  .stats { display: flex; gap: 0; margin-top: 90px; border: 2px solid var(--line); border-radius: 36px; overflow: hidden; background: color-mix(in oklab, var(--panel) 70%, transparent); }
  .stats div { flex: 1; padding: 40px 48px; border-right: 2px solid var(--line); }
  .stats div:last-child { border-right: 0; }
  .stats b { display: block; font-size: 86px; font-weight: 800; letter-spacing: -.05em; line-height: 1; }
  .stats span { display: block; font-size: 28px; color: var(--soft); margin-top: 14px; font-weight: 600; }
  .tag { position: absolute; font: 700 30px 'JetBrains Mono', monospace; background: var(--accent); color: var(--accent-ink); padding: 12px 24px; border-radius: 16px; box-shadow: 0 20px 60px -20px rgba(0,0,0,.5); }
  .caption { font: 600 30px 'Plus Jakarta Sans'; color: var(--faint); margin-top: 26px; }
  .cols { display: grid; gap: 60px; }
`

/** One slide: its file name, whether it is light, and its body. */
const SLIDES_DEF = [
  {
    name: '01-cover',
    body: () => `
      <div class="glow"></div><div class="dots"></div>
      <div class="frame">
        <div class="split" style="grid-template-columns: 1300px 1fr;">
          <div>
            <span class="eyebrow">Klyv · React component library</span>
            <h1>Every component your product needs.<br/><span class="quiet">Themed by</span> <span class="slab">one colour</span></h1>
            <p class="lede">${FACTS.components} accessible React components and ${FACTS.screens} finished screens. Change one colour and every one of them follows.</p>
          </div>
          <div class="shot" style="height: 1320px;"><img src="${capture('hero-dark')}" style="object-position: center top"/></div>
        </div>
        <div class="stats" style="margin-top: 0; margin-bottom: 160px;">
          <div><b>${FACTS.components}</b><span>components</span></div>
          <div><b>${FACTS.fresh}</b><span>new this release</span></div>
          <div><b>${FACTS.showpieces}</b><span>showpieces</span></div>
          <div><b>${FACTS.contrast}</b><span>contrast on any accent</span></div>
          <div><b>${FACTS.dependencies}</b><span>runtime dependencies</span></div>
        </div>
      </div>`,
  },
  {
    name: '02-one-colour',
    light: true,
    body: () => `
      <div class="dots"></div>
      <div class="frame">
        <div class="split" style="grid-template-columns: 1180px 1fr;">
          <div>
            <span class="eyebrow">Theming</span>
            <h1>One colour.<br/><span class="quiet">Everything follows.</span></h1>
            <p class="lede">Four tokens are derived from a single hue — the fill, its press state, a wash and the text on top — and the text is chosen by contrast, never guessed.</p>
            <ul class="points">
              <li><div>${FACTS.contrast} contrast, checked on any hue<small>The label colour prefers a tinted near-black, then white — whichever clears it.</small></div></li>
              <li><div>A rebrand is one call<small style="font-family: 'JetBrains Mono'">applyAccent('#8b5cf6')</small></div></li>
            </ul>
          </div>
          <div class="cols" style="grid-template-columns: 1fr 1fr;">
            ${['volt', 'ultraviolet', 'signal', 'coral'].map((name) => `<div class="shot" style="height: 700px;"><img src="${capture(`accent-${name}`)}" style="object-position: center; transform: scale(1.6)"/></div>`).join('')}
          </div>
        </div>
      </div>`,
  },
  {
    name: '03-make-it-yours',
    light: true,
    body: () => `
      <div class="dots"></div>
      <div class="frame">
        <div class="split" style="grid-template-columns: 1080px 1fr;">
          <div>
            <span class="eyebrow">Make it yours</span>
            <h1>Drop your logo.<br/><span class="quiet">Watch the site become your brand.</span></h1>
            <p class="lede">Drag any image onto the page. Its colours are read in the browser — nothing is uploaded — and the most vivid one themes every component on the site.</p>
          </div>
          <div class="shot" style="height: 1500px;"><img src="${capture('brand-palette')}" style="object-fit: contain; background: #fff"/></div>
        </div>
      </div>`,
  },
  {
    name: '04-real-screens',
    body: () => `
      <div class="glow"></div><div class="dots"></div>
      <div class="frame">
        <span class="eyebrow">Beyond buttons</span>
        <h1 style="max-width: 24ch">The screens you would otherwise <span class="quiet">spend a sprint on.</span></h1>
        <div style="display: grid; grid-template-columns: 1fr 820px; gap: 110px; margin-top: 90px; align-items: start;">
          <div class="shot" style="height: 1150px;"><img src="${capture('toolkit')}" style="object-position: center top"/></div>
          <ul class="points" style="margin-top: 20px;">
            <li><div>Trace waterfalls &amp; flame graphs<small>Critical path marked, frames zoomable</small></div></li>
            <li><div>Error budgets &amp; forecasts<small>Burn-rate alerts, Holt–Winters fitted in the browser</small></div></li>
            <li><div>Regex, cron &amp; date tools<small>Explained token by token, next runs in your zone</small></div></li>
            <li><div>Three-way merge &amp; JSON diff<small>Every one live — select, resolve, edit</small></div></li>
          </ul>
        </div>
      </div>`,
  },
  {
    name: '05-atlas',
    light: true,
    body: () => `
      <div class="frame" style="padding-bottom: 0;">
        <div style="display: flex; justify-content: space-between; align-items: end; gap: 120px;">
          <div>
            <span class="eyebrow">The Atlas</span>
            <h1>The whole library,<br/><span class="quiet">on one canvas.</span></h1>
          </div>
          <p class="lede" style="max-width: 26ch; margin-bottom: 20px;">All ${FACTS.components} components laid out like a map. Zoom in and the tiles start running — each one the real component, not a picture of it.</p>
        </div>
        <div class="shot" style="margin-top: 80px; height: 1300px; border-bottom-left-radius: 0; border-bottom-right-radius: 0;"><img src="${capture('atlas-charts')}" style="object-position: center 55%"/></div>
      </div>`,
  },
  {
    name: '06-constellation',
    body: () => `
      <div style="position: absolute; top: 0; bottom: 0; left: 720px; right: -200px;"><img src="${capture('constellation-text')}" style="width: 100%; height: 100%; object-fit: cover; object-position: center 40%; opacity: .95"/></div>
      <div style="position: absolute; inset: 0; background: linear-gradient(90deg, var(--bg) 18%, color-mix(in oklab, var(--bg) 70%, transparent) 38%, transparent 60%);"></div>
      <div class="frame" style="justify-content: center; max-width: 1500px;">
        <span class="eyebrow">The Constellation</span>
        <h1>See how it<br/>is built.</h1>
        <p class="lede">Every component a star, every line a real import. Point at Text and the ${FACTS.textUsers} components that use it light up across every part of the library.</p>
      </div>`,
  },
  {
    name: '07-anatomy',
    body: () => `
      <div class="glow"></div>
      <div class="frame">
        <div class="split" style="grid-template-columns: 1100px 1fr;">
          <div>
            <span class="eyebrow">Anatomy</span>
            <h1>Take a card apart.<br/><span class="quiet">Every layer is a component.</span></h1>
            <p class="lede">A working card pulls apart in 3D into the components it is made of, each one named. It is the live interface — type in the field while it floats.</p>
          </div>
          <div class="shot" style="height: 1500px;"><img src="${capture('anatomy')}" style="object-position: center 40%; transform: scale(1.12)"/></div>
        </div>
      </div>`,
  },
  {
    name: '08-showpieces',
    body: () => `
      <div class="glow"></div>
      <div class="frame">
        <div class="split" style="grid-template-columns: 1100px 1fr;">
          <div>
            <span class="eyebrow">Showpieces</span>
            <h1>Then it<br/>keeps going.</h1>
            <p class="lede">${FACTS.showpieces} components with a tag of their own — real fluid, light, cloth, ferrofluid. And EventHorizon: a black hole you drag across a working interface.</p>
            <ul class="points">
              <li><div>It warps the real elements<small>Pulled in, stretched, swallowed — and still clickable</small></div></li>
              <li><div>Themed by the same accent<small>With a still state for reduced motion</small></div></li>
            </ul>
          </div>
          <div class="shot" style="height: 1400px;"><img src="${capture('horizon')}" style="object-position: 35% center"/></div>
        </div>
      </div>`,
  },
  {
    name: '09-adopt',
    light: true,
    body: () => `
      <div class="dots"></div>
      <div class="frame">
        <span class="eyebrow">Adopt without a rewrite</span>
        <h1>Bring your code. <span class="quiet">See what it is made of.</span></h1>
        <div style="display: grid; grid-template-columns: 1.45fr 1fr; gap: 70px; margin-top: 80px;">
          <div>
            <div class="shot" style="height: 1180px;"><img src="${capture('migrate-code')}" style="object-position: left top"/></div>
            <p class="caption">Migrate — paste a shadcn/ui, MUI or Chakra file and get Klyv back, with every gap reported.</p>
          </div>
          <div>
            <div class="shot" style="height: 1180px;"><img src="${capture('xray-screen')}" style="object-position: center 30%"/></div>
            <p class="caption">X-ray — point at any screen and it names the component, and the ones around it.</p>
          </div>
        </div>
      </div>`,
  },
  {
    name: '10-measured',
    body: () => `
      <div class="glow"></div><div class="dots"></div>
      <div class="frame">
        <span class="eyebrow">Measured, not claimed</span>
        <h1>Trust it because <span class="quiet">you checked.</span></h1>
        <div style="display: grid; grid-template-columns: 1.25fr 1fr; gap: 70px; margin-top: 80px;">
          <div>
            <div class="shot" style="height: 980px;"><img src="${capture('proving-numbers')}" style="object-fit: contain; background: #f4f7f0"/></div>
            <p class="caption">Proving ground — mount a component a thousand times and measure it on your own machine.</p>
          </div>
          <div>
            <div class="shot" style="height: 980px;"><img src="${capture('kit-card')}" style="object-position: center top"/></div>
            <p class="caption">Kit builder — weigh any set before installing it, with shared code counted once.</p>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 50px; margin-top: 70px;">
          <div class="points" style="margin: 0; display: block;"><li><div>Every component axe-audited<small>Keyboard paths driven in tests</small></div></li></div>
          <div class="points" style="margin: 0; display: block;"><li><div>Own the source<small style="font-family: 'JetBrains Mono'">npx klyv add flame-graph</small></div></li></div>
          <div class="points" style="margin: 0; display: block;"><li><div>Agent-ready<small>MCP server, ${FACTS.tools} tools, Agent Skill</small></div></li></div>
          <div class="points" style="margin: 0; display: block;"><li><div>${FACTS.dependencies} runtime dependencies<small>Plain React, typed props</small></div></li></div>
        </div>
      </div>`,
  },
]

const page = (slide) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Klyv — ${slide.name}</title>
<style>${STYLE}</style>
</head>
<body class="${slide.light ? 'light' : ''}">
${slide.body()}
<div class="brand"><span class="mark">K</span>Klyv</div>
<div class="install"><b>$</b> npm i klyv</div>
</body>
</html>
`

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1 })
const tab = await context.newPage()
const only = process.argv.slice(2)

for (const slide of SLIDES_DEF) {
  if (only.length && !only.includes(slide.name)) continue
  const file = join(SLIDES, `${slide.name}.html`)
  writeFileSync(file, page(slide))
  await tab.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' })
  await tab.evaluate(() => document.fonts.ready)
  await tab.screenshot({ path: join(IMAGES, `${slide.name}.jpg`), type: 'jpeg', quality: 92 })
  console.log(`rendered ${slide.name}`)
}

await browser.close()
