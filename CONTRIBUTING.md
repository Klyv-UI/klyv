# Contributing to Klyv

Thanks for helping. Klyv is an accent-led React component library plus the docs
site that describes it. This guide covers getting set up and what a pull
request needs before it can merge.

## Setup

Requires Node 18+ (CI runs Node 22).

```bash
git clone https://github.com/Klyv-UI/klyv.git
cd klyv
npm install
npm run dev
```

`npm run dev` regenerates the metadata in `data/` and `src/site/data/`, then
starts the docs site on Vite.

## Where things live

- `src/components/<Name>/` — one flat folder per component, named after it,
  with an `index.ts`. Export new components from `src/index.ts`.
- `src/lib`, `src/theme`, `src/tokens`, `src/styles` — shared helpers, accent
  derivation and the design tokens.
- `src/site/` — the documentation site. Never shipped with the package.
- `cli/`, `mcp/`, `skills/` — the `klyv` CLI, the MCP server and the agent skill.
- `scripts/` — generators and the rule checks.
- `test/`, `e2e/` — vitest suites and Playwright browser checks.

See the **Project layout** section of the README for more.

## House rules

Every component follows these (the README explains each):

1. No new tokens — colour, radius, shadow and type come from the token files.
2. Reduced motion is a real state, not the animation with the movement deleted.
3. Every gesture has a keyboard path and the matching ARIA pattern.
4. No React render per animation frame.
5. Decoration is `aria-hidden`.

`npm run rules` enforces the checkable ones: reduced motion, no hard-coded
colour, no hard-coded radius.

## Before you open a pull request

```bash
npm run lint       # types
npm run generate   # regenerate data/ — commit the result
npm test           # interaction, platform, axe and MCP suites
```

CI fails if the committed files in `data/` or `src/site/data/` differ from what
`npm run generate` produces, so always commit the regenerated output alongside
your change.

If you change a component's appearance, `npm run test:browser` runs the
Playwright checks locally.

## Pull requests

- Keep each PR to one change; open an issue first for anything large.
- Describe what changed and why, and link the issue it closes.
- Use a short imperative title, e.g. `feat: add Stepper` or `fix: Menu focus
  on close`.

By contributing you agree your work is released under the [MIT License](LICENSE).
