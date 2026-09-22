---
name: klyv
description: Build UI with the Klyv React component library — 250+ accessible components driven by a single accent colour. Use whenever writing or reviewing React UI in a project that depends on `klyv`, or when the user asks for a component, screen, form, dashboard, dialog, chart or layout and Klyv is available. Covers finding the right component, its real props, the design tokens, dark mode, and the rules every component follows.
---

# Building with Klyv

Klyv is a React component library of more than 290 components in thirteen groups. Every
emphasis in it — buttons, charts, focus rings, the page behind them — resolves
to one accent colour and three values derived from it.

## Before writing any UI

1. **Find the component before inventing one.** Over 250 is more than anyone
   remembers. Search by the job, not the name: "drag", "empty state", "date
   range", "presence".
2. **Read its real props.** Types and defaults are generated from the source,
   so they are exact. Do not guess prop names.
3. **Never invent a colour, radius or shadow.** Everything comes from tokens.
4. **Building a whole page? Start from a block.** A sign-in screen, an admin
   panel or a settings page already exists as a working block — adapt it
   rather than assembling one from scratch (`npx klyvui add block <slug>`).

If the Klyv MCP server is connected, use its tools for all three:

| Tool | For |
| --- | --- |
| `search_components` | find by name, group, or what it does |
| `get_component` | props, types, defaults, ARIA roles, size, dependencies |
| `get_component_source` | the real source, optionally with everything it imports |
| `get_design_tokens` | colour, radius, shadow, type, and dark-mode values |
| `get_design_rules` | the design system and the five house rules |
| `list_blocks` | whole screens — sign-in, dashboard, settings and more |
| `get_block` | one screen: its components, its packages and its full source |
| `list_groups` | the thirteen groups and their counts |
| `how_to_install` | package, stylesheet, peer dependencies |

Without the MCP server, the same data is in the package: `data/components.json`,
`data/props.json`, `data/tokens.json`, and `npx klyvui list <query>`.

## Setup

```bash
npm install klyvui
```

```tsx
import { Button, DataTable, applyAccent } from 'klyvui'
import 'klyvui/styles.css'
```

`klyvui/styles.css` is prebuilt and needs no Tailwind. If the project already
runs Tailwind, import `klyvui/preset.css` instead so the utilities land in its
build rather than shipping twice.

## Theming

One call retints everything, at runtime:

```ts
import { applyAccent, applyMode } from 'klyvui'

applyAccent('#8b5cf6')   // accent, accent-strong, accent-soft, accent-ink
applyMode('dark')        // 'light' | 'dark' | 'system'
```

`--color-accent-ink` — the text that sits *on* the accent — is chosen by
contrast, so any hue stays readable without a second setting. Do not hard-code
a label colour on an accent surface; use `text-accent-ink`.

The full theme is five settings, any subset of which `applyTheme` merges in:

```ts
import { applyTheme, themeToCss, THEME_PRESETS, ThemeScope } from 'klyvui'

applyTheme({ accent: '#8b5cf6', base: 'slate', radius: 'lg', font: 'inter', style: 'flat' })
applyTheme(THEME_PRESETS.find((preset) => preset.id === 'ledger')!.theme)
const css = themeToCss({ base: 'sand', radius: 'sm' }) // paste-able, no runtime
```

- `base`: `sage` (default), `neutral`, `zinc`, `slate`, `stone`, `gray`, `mauve`,
  `olive`, `sand`, `tinted`, or `{ hue, chroma }` in OKLCH. Derived text always
  clears 4.5:1 on every background, in both modes.
- `radius`: `none`, `sm`, `md`, `default`, `lg`, `xl`, or a multiplier.
- `font`: `plus-jakarta`, `inter`, `geist`, `dm-sans`, `manrope`, `figtree`,
  `ibm-plex-sans`, `space-grotesk`, `outfit`, `system`, `newsreader`, or
  `{ family }`. Nothing is fetched; use `fontStylesheetUrl` or `loadFont`.
- `style`: `soft` (default), `flat`, `outline`, `elevated`.

For one section use `<ThemeScope theme={{ accent: '#f43f5e' }}>`, not
`applyTheme` on a div: it re-applies on mode changes. Radii in components come
from tokens (`rounded-[var(--radius-10)]`, `rounded-[var(--radius-card)]`) so
they follow the radius setting; never write `rounded-[10px]`.

## Writing components with it

- **Surfaces stack, they do not tint.** `canvas` → `shell` → `app` → `surface`
  → `surface-muted` / `surface-sunken`. Depth is stack order and a hairline,
  not a heavy shadow. Reach for `<Surface>` before a bare div — `variant` is
  `'card' | 'tile' | 'field' | 'sunken' | 'floating'`.
- **Text goes through `Text`.** The type scale is a component, not a set of
  classes. `size` runs `display | title | amount | subtitle | heading | stat |
  body | label | caption | micro`; `tone` is `default | soft | faint | accent |
  success | danger | inverse`.
- **Three ink steps**, all clearing 4.5:1: `ink`, `ink-soft`, `ink-faint`.
  `ink-inverse` is text on `ink` and flips with the theme.
- **`cn` merges classes** so later Tailwind utilities win: `cn('p-2', className)`.
- **Icons are a structural type.** Anything taking `size`, `strokeWidth` and
  `className` works — Lucide, Phosphor, your own SVG.

## The rules every component obeys

Follow these when composing, too — they are what keep the set coherent.

1. **No new tokens.** A component needing a new colour or radius is a component
   breaking the system.
2. **Reduced motion is a real state** — not the animation with movement
   deleted. The still frame must still say what it means.
3. **Every gesture has a key.** Swipe, drag, hold and pinch each need a
   keyboard path and the ARIA pattern that announces it.
4. **No React render per animation frame.** Write to CSS custom properties or
   node styles inside one `requestAnimationFrame`.
5. **Decoration is `aria-hidden`.** Hide what carries no meaning rather than
   describing it.

## Two ways to take a component

Install and import, or copy the source:

```bash
npx klyvui add data-table     # 21 files: the component and all it imports
npx klyvui info combobox      # what it would bring with it
```

The folders are flat and every internal import is relative, so a copy compiles
where it lands — no rewriting, no codemod.

## Common mistakes

- Guessing prop names instead of reading them. Sizing is not spelled the same
  way twice: `Select` takes `size`, but `Switch` omits the DOM's `size` and
  takes `switchSize`. Confirm with `get_component` rather than assuming.
- Reaching for a controlled API that is not there. `Switch` and `Slider` extend
  `InputHTMLAttributes` — they are native inputs, so they take `checked` /
  `value` and `onChange`. There is no `onCheckedChange` or `onValueChange`.
  `get_component` lists this under `inherits`.
- Wrapping a `Button` in a link. A button inside an anchor is invalid nested
  interactive markup. Render the button as the link instead:
  `<Button as={Link} to="/start">Start</Button>`.
- Writing `bg-ink text-white`. In dark mode `ink` is near-white, so the label
  disappears. Use `text-ink-inverse`.
- Using `tone="accent"` for text sitting *on* an accent fill. That tone is the
  accent colour readable on a normal surface; for text on the accent use
  `text-accent-ink`.
- Adding a second `<nav>` or `role="search"` landmark without a distinct
  `label`. Two landmarks of a kind must be told apart.
