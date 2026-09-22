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

Component folders are flat and named after the component, not filed under the
browsing groups. The groups live in `src/site/data/catalog.ts` and can change
without moving a file. Internal imports are relative, which is what lets
`klyv add` copy a component into another project unchanged.

## House rules

Every component follows these:

1. **No new tokens.** Colour, radius, shadow and type come from the token files.
   A component that needs a new value is a component that breaks the system.
2. **Reduced motion is a real state**, not the animation with the movement
   deleted. The still frame still has to say what the component means.
3. **Every gesture has a key.** Swipe, drag, hold and pinch each have a keyboard
   path beside them, and the ARIA pattern that makes them announceable.
4. **No React render per animation frame.** Animation writes to CSS custom
   properties or node styles inside one `requestAnimationFrame`.
5. **Decoration is `aria-hidden`.** Anything that carries no meaning is hidden
   from assistive technology rather than described to it.

`npm run rules` enforces the checkable ones, and `npm run generate` runs it:

- **Reduced motion:** anything that animates must opt out under the preference.
  Motion that is the point of the component (a spinner) is exempt by name, with
  a reason.
- **No hard-coded colour:** every hex literal outside an explicit allowlist fails.
  The allowlist is for colour that is physical, not thematic: a piano's keys, a
  terminal's traffic lights.
- **No hard-coded radius:** use the token of the same size, such as
  `rounded-[var(--radius-10)]`, never `rounded-[10px]`.

Every module that can't run on the server carries `'use client'`, and every
module that can doesn't. `npm run directives` fixes them to match the code.

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

## Releasing

Maintainers only. Publishing runs from CI, so nobody needs npm credentials on
their machine.

```bash
git switch -c release/1.0.1
npm version patch        # or minor, or major — commits and tags
```

Open a pull request, merge it once CI is green, then push the tag and create a
GitHub release on it. The [Release workflow](.github/workflows/release.yml)
type-checks, runs the full suite, builds the package and publishes it to npm.

It refuses to publish if the release tag and the version in `package.json`
disagree, because a published version can never be replaced. Running the
workflow by hand from the Actions tab does everything except publish, which is
a useful dry run.

Authentication is npm's trusted publishing, so there is no token in this
repository, and every release carries provenance linking it to the commit and
the workflow run it came from.
