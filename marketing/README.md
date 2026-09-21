# Marketing images

Ten 4K (3840 × 2160) images for promoting Klyv, in [`images/`](images).

Every screenshot in them is the running product, captured by driving the real
site with Playwright: a logo dropped on the page, a card pulled apart in 3D, a
benchmark actually run, a star in the constellation actually hovered. Every
figure on them is one the site itself reports. Nothing is mocked, which is the
point — it is the same promise the landing page makes.

| Image | What it sells |
| --- | --- |
| `01-cover` | The product: 614 components, themed by one colour, with the headline numbers |
| `02-one-colour` | Theming — the same working card in four accents, contrast checked on any hue |
| `03-make-it-yours` | Drop a logo and the site becomes that brand, read in the browser |
| `04-real-screens` | Beyond buttons — traces, flame graphs, error budgets, merges, all live |
| `05-atlas` | The whole library on one canvas, running as you zoom in |
| `06-constellation` | How it is built — every import drawn; Text lights its 248 users |
| `07-anatomy` | A working card taken apart into its components |
| `08-showpieces` | EventHorizon, a black hole that warps a working interface |
| `09-adopt` | Migrate from shadcn/ui, MUI or Chakra; X-ray any screen |
| `10-measured` | Proving ground and kit builder — trust it because you checked |

## Regenerating

The images go stale when the product changes, so they are built rather than
kept by hand. With the site running:

```bash
npm run dev
BASE=http://localhost:5173 node marketing/capture.mjs   # photographs the product → marketing/captures
node marketing/render.mjs                                # lays them out → marketing/images
```

Either script takes names to redo just some: `node marketing/capture.mjs atlasCharts`,
`node marketing/render.mjs 05-atlas`.

- **`capture.mjs`** drives the site and saves each feature at 2× resolution, so
  it stays sharp inside a 4K frame. The captures are intermediate and not
  committed.
- **`render.mjs`** writes each slide as an HTML file in [`slides/`](slides) —
  open one in a browser to adjust it — and photographs it at exactly
  3840 × 2160. The figures on the slides live in `FACTS` at the top of the
  file; update them there if the catalogue changes.
