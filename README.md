# Citrine

**An accent-led React component library.** 250+ components that take their entire
personality from a single colour — pick a hue and the whole set repaints:
buttons, charts, focus rings, and the page behind them.

---

## Install

```bash
npm install citrine
```

```tsx
import { Button, DataTable, applyAccent } from 'citrine'
import 'citrine/styles.css'
```

That is the whole setup. **`citrine/styles.css` is prebuilt** — 14.7 KB gzipped,
containing the tokens, the base layer, the keyframes and exactly the utilities
the library uses. You do not need Tailwind to use this package.

If you *do* run Tailwind, import the preset instead so those utilities end up in
your build rather than being shipped twice:

```css
@import 'tailwindcss';
@import 'citrine/preset.css';
```

| Export | |
| --- | --- |
| `citrine` | the components, `cn`, the token registry, the theme API |
| `citrine/styles.css` | prebuilt stylesheet — no Tailwind required |
| `citrine/preset.css` | tokens plus an `@source` for Tailwind users |
| `citrine/tokens.css` | the tokens alone |
| `citrine/tokens.json` | the tokens as W3C Design Tokens data |

**ESM only**, one module per component with `sideEffects` declared, so bundlers
drop what you do not use. Measured against a React-only baseline: importing
`Button` adds **21.5 KB raw, 7.2 KB gzipped** — most of which is
`tailwind-merge`, shared by every component after the first.

`react` and `react-dom` are peer dependencies (18.3 or 19). The only runtime
dependencies are `clsx` and `tailwind-merge`.

### Or copy the source instead

The package ships its own source as well as its build, so `citrine add` works
from an installed copy — see **Taking a component** below. Install it if you
want upgrades; copy it if you want to own the file.

## One hue drives everything

Four CSS custom properties are derived from one colour and written to
`<html>` at runtime. Nothing in the library hard-codes a colour, so a single
call restyles every component without a rebuild.

```ts
import { applyAccent, saveAccent } from 'citrine'

applyAccent('#8b5cf6') // accent, accent-strong, accent-soft, accent-ink
saveAccent('#8b5cf6')  // remembered, and restored before first paint
```

| Derived value | How | Why |
| --- | --- | --- |
| `--color-accent` | the hue you picked | fills, chips, chart series |
| `--color-accent-strong` | same hue, lightness shifted | hover and press states |
| `--color-accent-soft` | same hue, desaturated to a wash | selected rows, soft badges |
| `--color-accent-ink` | a tinted near-black or white, whichever reads — never below 4.5:1 | text *on* the accent |

The ink is chosen **by contrast, not by a luminance cut-off**. An earlier rule
flipped to white below luminance 0.45; a sweep of every hue showed it handed
white labels to bright oranges and greens, where they read at 2.3:1 — half of
the shipped presets failed. It now prefers a tinted near-black, then white, then
whichever of pure black or white is stronger. That last step is a guarantee: for
any colour, one of the two reaches at least 4.58:1. Swept across 22,680 colours,
none fall below 4.5:1 for the label or for text on either wash.

`contrastRatio(a, b)` is exported, for checking your own pairs. So are
`onAccentChange` and `onModeChange`, which fire whenever the document's theme
changes from anywhere — every picker on the docs site shares one source of truth
through them, rather than each keeping a copy that goes stale.

## What is in it

254 components in twelve groups. The grouping describes what a component is
**for** — the only question anyone browsing a library arrives with.

| Group | Count | |
| --- | --- | --- |
| Foundations | 9 | the type scale, container recipes, utilities |
| Layout | 16 | structure, disclosure, stacks and scrolling |
| Navigation | 18 | bars, shells, tabs, steps, menus, search |
| Actions | 8 | buttons, and the richer controls built on them |
| Forms & Inputs | 37 | text, choice, ranges, dates, rich input |
| Data Display | 27 | identity, lists, tables, metrics, records |
| Charts | 17 | plots, gauges, distribution, flow, activity |
| Feedback | 26 | status, messages, empty states, celebration |
| Overlays | 11 | dialogs, popovers, guidance |
| Motion & Effects | 34 | entrances, kinetic type, light and surfaces |
| Interaction | 20 | touch and drag, presence, trust and workflow |
| Canvas & Play | 15 | generative, audio, physics, toys |

## Dependencies

Three at runtime, and none of them do any drawing:

- `react`
- `clsx` + `tailwind-merge` — merged into the `cn` helper

Icons are a **structural type** (`IconComponent`), not an import, so the
library is icon-set agnostic — bring Lucide, Phosphor, or your own SVGs. The
docs site uses `lucide-react` and `react-router-dom`; the library uses neither.

Charts, the QR code, the audio visualiser and the physics components are all
drawn by hand with SVG, canvas and Web Audio. There is no charting library.

## Project layout

```
src/
  index.ts             the public API — one entry point
  components/          one flat folder per component, named after it
    Button/            Button.tsx + index.ts
    Popover/           Popover.tsx + usePopoverPosition.ts + index.ts
    internal/          shared private helpers (the icon set)
  lib/                 cn, shared types, chart scale, motion hooks, time
  theme/               accent derivation, persistence, restore-before-paint
  tokens/              the token registry the docs read
  styles/              tokens.css, base.css, utilities.css
  site/                the documentation site (never shipped with the library)
    brand.ts           name and tagline, in one place
    data/              the catalogue, the dependency graph, the source loader
    examples/          per-component examples, described as data
    pages/             landing, catalogue, component page, tokens, foundations
cli/                   the `citrine add` command
scripts/               metadata generation and the `'use client'` check
```

The component folders are **flat and named after the component**, not filed
under the browsing taxonomy. A component is found by its name; the taxonomy
lives in `site/data/catalog.ts` and can be rearranged without moving a file.

## The docs site

- **Landing** — the pitch, with live components, not screenshots, and a
  **working admin panel** assembled only from library components: the table
  sorts, selects and paginates, the invite dialog validates and adds a real
  row, removing one raises a toast with a working undo.
- **/components** — the catalogue, filterable by group, searchable by name or
  by what a component does. Text only, deliberately: the page exists to scan 254
  names quickly, and a live preview per card made that slower than it was worth.
  The previews live on the component pages, where you have asked for one.
- **/components/:slug** — one page per component: its measured weight, the ARIA
  roles it renders, live previews, variants, the reasoning, an API table
  generated from the type, and the **Code** section.
- **/getting-started** — install, the stylesheet, the theme API and the first
  component: everything a new project needs before it writes any UI.
- **/foundations** — the six rules the tokens follow.
- **/tokens** — every token, and the theme switcher.
- **/playground** — a live prop playground.
- **/agents** — connecting a coding agent over MCP, and the Agent Skill.

### Taking a component

Two thirds of the library imports at least one sibling — `Button` needs
`Spinner`, `DataTable` needs eight components and three shared modules. So a
page never hands you one file and calls it done.

```bash
npx citrine add data-table      # 21 files, dependencies included
npx citrine add button switch   # several at once; shared files written once
npx citrine list drag           # search by name, group, section or blurb
npx citrine info combobox       # what it would bring with it
npx citrine add block dashboard # a whole screen, into src/blocks
npx citrine blocks              # every block
```

| Flag | |
| --- | --- |
| `--dest <dir>` | where to write (default `./src`) |
| `--dry` / `-n` | print the plan, touch nothing |
| `--force` / `-f` | overwrite files that already exist |

**No import rewriting happens, and none is needed.** The folders are flat and
every internal import is relative, so mirroring the same shape under your
destination makes each path resolve exactly as it did here. The CLI also copies
`styles/` the first time, because every component reads the tokens.

Each component page carries the same information: the `citrine add` command, a
linked list of what it depends on, the source itself, and **Copy all N files** —
one paste with a header comment above each file saying where it goes. The page
and the CLI resolve the same generated graph, so they can never disagree.

### The Code section

The source is read off disk at build time by
`import.meta.glob('...', { query: '?raw' })`. It is the same file the preview
above it is running, so it cannot drift. Multi-file components get one tab per
file. Long files are collapsed, and collapsing clips the height rather than
slicing the string — so find-in-page and Copy still see the whole file.

Highlighting is done by a ~60-line lexer in `components/CodeBlock/highlight.ts`.
A syntax library would ship a grammar engine and a palette of its own, both
larger than the component using them.

### The API table

Generated from the type, not maintained by hand. `scripts/generate-props.mjs`
walks each component's props declaration with the TypeScript AST and writes
`site/data/props.ts`:

| Column | Where it comes from |
| --- | --- |
| Prop, required | the declaration — `*` marks a member with no `?` |
| Type | the type node, printed as written (`DataTableColumn<Row>[]`) |
| Default | the **destructured parameter**, which is the only place a real default lives |
| Description | the member's JSDoc, falling back to the prose written beside the examples |

Polymorphic components split their props into `<Name>OwnProps` and intersect it
with the element's attributes; the generator follows that reference, which is
the difference between documenting `Surface` and documenting nothing. What it
cannot inline — `ButtonHTMLAttributes<HTMLButtonElement>` and friends — is named
under the table instead of being expanded into three hundred DOM rows.

**1,726 props across 254 components, every one described.** 82% carry JSDoc on
the member itself, so the text reaches a consumer's editor as a hover tooltip
and not only this site; the rest fall back to the prose written beside the
examples.

Prose describing something the type does not declare — a forwarded `ref`, a
native attribute, the rest spread — is kept and shown in an *Inherited* group
rather than dropped, and `npm run generate` prints those so a rename cannot
quietly orphan its documentation.

### Search

`⌘K` (`Ctrl+K`) opens the library's own `CommandPalette` over all 254
components, the twelve groups and the doc pages. It searches slugs and sections
as well as names, so `datatable`, `data-table` and `drag` all find something.

## Light and dark

One palette, two sets of values. Every token keeps its name and its job, so no
component has a dark variant, a `dark:` class, or any knowledge that a second
theme exists.

```ts
import { applyMode, saveMode } from 'citrine'

applyMode('dark')     // 'light' | 'dark' | 'system'
saveMode('dark')      // remembered; restored before first paint
```

`system` is a real third state, not the absence of a choice: it removes the
attribute so the stylesheet's media query takes over, and the page keeps
following the machine. An inline script in `index.html` applies the remembered
mode before the stylesheet paints, so a reader who chose dark never sees a
white flash.

The accent's soft wash is the one derived value that differs between themes — a
90%-light tint is a background on a white page and a glare on a black one — so
`deriveAccent` returns both and `applyAccent` writes whichever matches.

### What dark mode found

Adding a second theme is the cheapest audit a design system ever gets: anything
that hard-codes a colour instead of reading a token breaks immediately and
visibly. This pass turned up eight real defects, most of which were also wrong
in light:

| | |
| --- | --- |
| `PromoBanner` | hard-coded a green derived from the default lime — broken under **every** non-default accent, not just in dark |
| `Text tone="accent"` | resolved to `accent-ink`, the colour for text *on* the accent. Near-black on a near-black page |
| `Button variant="white"` | `bg-white text-ink` — the background stayed white while the label turned near-white |
| `Tag tone="accent"` | dark ink on the dark wash, 1.65:1 |
| Modal/Drawer/palette scrims | drawn from `ink`, so the backdrop lit the page up instead of pushing it back |
| `bg-ink text-white` (7 places) | inverted to a light chip with white text |
| `StreakCounter`, `ScratchCard`, `StickerPeel` | pale surfaces painted for a white page |
| `ink-soft` / `ink-faint` | **4.4:1 and 2.61:1 in light** — a pre-existing AA failure across 240+ elements |

Two semantic tokens were added, because a second theme genuinely needs them:
`--color-ink-inverse` (text *on* ink, flips with the theme) and `--color-scrim`
(dark in both themes — a backdrop that inverted would be a spotlight).

The ink scale was darkened to clear 4.5:1 at every step: `ink-soft` `#74797d`
→ `#5c6165`, `ink-faint` `#9ca1a5` → `#6a7075`. That is a visible change to the
light theme; reverting it is those two values in `styles/tokens.css`.

Audited with a contrast pass over every text node on the landing page and the
component pages: **0 failures in either theme**, excluding decorative
`aria-hidden` layers and text over canvas.

## React Server Components

Every module that cannot run on a server boundary carries `'use client'`, and
every module that can does not:

| | |
| --- | --- |
| Client modules | 184 |
| Server-safe modules | 65 |

`Text`, `Surface`, `Badge` and 60-odd others are pure functions of their props
and stay on the server. Anything using hooks, `forwardRef`, a portal, an inline
event handler or a browser API is marked.

The split is derived, not maintained by hand — `npm run generate` re-derives it
and fails the build if a file drifts out of sync:

```bash
npm run directives   # add or remove directives to match the code
npm run generate     # regenerate the graph, then verify the directives
```

## Accessibility, audited

```bash
npm run test:a11y
```

Renders **all 254 component pages** — examples, API table and all — into jsdom
and runs axe over each. 239 tests, about 80 seconds.

Two rules are off, for reasons rather than convenience. `color-contrast` needs
layout, which jsdom does not do, so contrast is audited in a real browser
instead (that pass is what found the ink bug above). `region` expects the
landmarks the site shell supplies, and a page is rendered here without it. The
Code section is excluded because it is the same source viewer on every page —
audited once as `CodeBlock`, not 254 times, which is the difference between a
80-second suite and a forty-minute one.

The first run found five things, and separating the real ones from the noise was
the point:

| | |
| --- | --- |
| `Calendar` | **critical** — `aria-selected` on every day *button*. In the grid pattern selection belongs to the cell; it is now on `td[role="gridcell"]`, all 84 nodes |
| `MentionInput` | `role="combobox"` on a `<textarea>`, which ARIA does not allow. It keeps its textbox role and the attributes a textbox may legally carry |
| `Breadcrumb`, `Pagination`, `FilterBar` | not component bugs — the docs pages showed several instances sharing one landmark name. Each now passes a distinct `label`, which is what a consumer with two of them must do |

Now: **0 violations, 0 crashes**, across every page.

## Keyboard behaviour, tested

axe reads markup; it cannot press a key. The claims this library makes about
using it from a keyboard — Escape closes a dialog and focus returns to whatever
opened it, arrow keys move a splitter, Enter saves an inline edit and Escape
restores it — now have a suite of their own.

```bash
npm run test:interaction
```

36 tests across seven files, driven with `@testing-library/user-event`, so the
events are the ones a browser dispatches rather than a synthetic click. They
cover Modal and Lightbox (focus trap, Escape, scroll lock, focus handed back),
Tabs and SegmentedControl (roving focus, arrow keys, Home and End), ToggleGroup,
SplitPane, InlineEdit, CopyButton, PasswordStrength, DataTable sorting and
selection, VirtualList, BulkActionBar, Countdown and RelativeTime.

The two timed components are tested against a frozen clock, advanced one
interval at a time. React runs effects when an act block finishes, so moving
the clock an hour in a single step fires exactly one timer — stepping is what a
real page does, where every timeout lands on its own task.

## Rules the build enforces

Two of the house rules below are checkable, so they are checked. Both run in
`npm run generate`, which `predev` and `prebuild` call — a stated rule that
nothing enforces is a rule that decays.

**Reduced motion.** Anything that animates must opt out under the preference.
The check distinguishes a self-scheduling `requestAnimationFrame` loop from the
one-shot calls used to *measure* — Collapse reads a height that way, Menu
positions a popover — because treating those as animation buries the real
findings in noise. Motion that is the point of the component is exempt by name
and with a reason (`Spinner`: a spinner that does not spin conveys nothing).

It found three real ones on its first run: `Skeleton` and the indeterminate
`Progress` pulsed forever under the preference, and `Ripple` played its keyframe
regardless. All three now carry `motion-safe-only`.

**No hard-coded colour.** Every hex literal outside an explicit allowlist is a
failure. The allowlist is components whose colour is physical rather than
thematic — a piano's keys, a terminal's traffic lights, per-person cursor
identity, the swatches inside a colour picker — each listed with why.

```bash
npm run rules
```

## Design tokens as data

`dist/tokens.json` is the token set in W3C Design Tokens format, parsed out of
the stylesheet rather than duplicated in JavaScript, so there is still one
source of truth. Dark mode ships as a `$modes` entry because it changes values
and never names.

```json
{ "color": { "accent": { "$value": "#c8f24e", "$type": "color" } } }
```

## For AI agents

Two ways for a coding agent to know what is in here. Both are generated from
the same data the docs site and the CLI read, so none of the three can drift.

**An MCP server**, shipped with the package:

```bash
claude mcp add citrine -- npx -y citrine-mcp
```

or, for anything that reads `mcp.json`:

```json
{ "mcpServers": { "citrine": { "command": "npx", "args": ["-y", "citrine-mcp"] } } }
```

Nine tools: `search_components`, `get_component` (every prop with its real
type and default, ARIA roles, gzipped size, dependencies),
`get_component_source` (optionally with everything it imports), `list_blocks`
and `get_block` (whole screens, with the components each uses and its full
source), `list_groups`, `get_design_tokens`, `get_design_rules`,
`how_to_install`. The same knowledge is served as resources too —
`citrine://catalog`, `citrine://blocks`, `citrine://tokens`, `citrine://rules`,
`citrine://usage` — for clients that prefer to attach documents over calling
tools.

It is plain JSON-RPC 2.0 over stdio in one file, with no SDK: a library that
advertises two runtime dependencies should not quietly add a third.
`npm run test:mcp` spawns the real process and talks to it over real pipes.

**An Agent Skill**, `skills/citrine/SKILL.md`, carrying the same guidance for
harnesses that load skills instead: which component to reach for, the theming
API, the house rules, and the mistakes that come up most.

More in [`mcp/README.md`](mcp/README.md), or on the **/agents** page of the docs
site, whose tool table is generated from the server's own definitions.

## House rules

Every component in the library obeys these, and the page for each one says how.

1. **No new tokens.** Colour, radius, shadow and type come from one file. A
   component that needed a new value would be a component that broke the system.
2. **Reduced motion is a real state**, not the animation with the movement
   deleted — the still frame still has to say what the component means.
3. **Every gesture has a key.** Swipe, drag, hold and pinch each have a
   keyboard path beside them and the ARIA pattern that makes them announceable.
4. **No React render per animation frame.** Animation writes to CSS custom
   properties or node styles inside one `requestAnimationFrame`.
5. **Decoration is `aria-hidden`.** Anything that carries no meaning is hidden
   from assistive technology rather than described to it.

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | regenerate metadata, then the Vite dev server |
| `npm run build` | regenerate, typecheck, then production build |
| `npm run generate` | rebuild the dependency graph and the API tables, and verify `'use client'` |
| `npm run directives` | add or remove `'use client'` to match the code |
| `npm run lint` | `tsc -b --noEmit` |
| `npm run preview` | serve the built site |
| `npm run citrine -- add <name>` | run the CLI from this repo |
| `npm run build:lib` | build the publishable package (JS, types, CSS, sizes, tokens) |
| `npm run rules` | check reduced motion and hard-coded colour |
| `npm run test:a11y` | render every component page, block and the landing page, and audit each with axe |
| `npm run test:interaction` | drive the keyboard paths with user-event |
| `npm test` | all three suites: interaction, axe, then the MCP server |
| `npm run mcp` | run the MCP server on stdio |
| `npm run test:mcp` | drive the MCP server over real pipes |
| `npm pack` | build and tarball it |
