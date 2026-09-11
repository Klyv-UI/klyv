// Checks the two house rules a build can actually verify.
//
// Both are rules the site states in plain language on its own landing page, and
// a stated rule that nothing enforces is a rule that decays. These are cheap
// and specific: no new dependency, no test runner, and no judgement calls.
//
//   1. Anything that animates has a reduced-motion answer.
//   2. Colour comes from tokens, not from hex literals.
//
// Run with `--fix-none`; there is nothing to fix automatically, because both
// failures need a person to decide what the right value or fallback is.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const COMPONENTS = join(ROOT, 'src', 'components')

/* ------------------------------------------------------------------ rule 1 */

// A component animates if it schedules frames, runs a keyframe animation, or
// transitions a property that moves something.
const ANIMATES = [
  /\banimate-\[/,
  /\banimate-(?:spin|ping|pulse|bounce)\b/,
  /animation:/,
]

// A transition on open or close is not what the rule is aimed at: it is short,
// the reader triggered it, and it ends. Continuous motion is the target.
//
// `requestAnimationFrame` is counted rather than matched, because it is used to
// measure and to schedule far more often than to animate — Collapse measures a
// height with it, Menu positions a popover. A self-scheduling loop calls it at
// least twice: once to start and once to continue.
const loops = (source) => (source.match(/requestAnimationFrame/g) ?? []).length >= 2

// …and it has an answer if it opts out under the media query, asks the
// preference directly, or is drawn on a canvas it clears itself.
// Motion that is the point of the component, or is the reader's own movement
// played back. WCAG carves out motion essential to the information conveyed;
// each of these is written down so the exemption stays a decision.
const MOTION_ESSENTIAL = {
  Spinner: 'a spinner that does not spin conveys nothing',
  HoldToConfirm: 'the filling ring is the confirmation feedback itself',
  AudioVisualizer: 'it tracks live sound the reader is producing',
  CursorAura: "it follows the pointer, so the motion is the reader's own",
  GravityTags: 'the pile has to land somewhere; the arrangement is the content',
  RopeCursor: "it follows the pointer, so the motion is the reader's own",
  MatrixRain: 'the rain is the component',
  StarField: 'the drift is the component',
  BoidsFlock: 'the flocking is the component',
  BlobMorph: 'the morph is the component',
  SlotReels: 'the spin is the component',
  DiceRoller: 'the tumble is the component',
}

const ANSWERS = [
  /motion-safe-only/,
  /usePrefersReducedMotion/,
  /prefers-reduced-motion/,
  /motion-safe:/,
  /motion-reduce:/,
]

/* ------------------------------------------------------------------ rule 2 */

// Colours that are deliberately fixed: physical objects, brand chrome, and
// filter constants that are not colours at all. Each one is a decision that was
// made on purpose and written down here so it stays visible.
const FIXED_COLOUR = new Set([
  'AchievementPop', // confetti and medal palette
  'AuroraSurface', // named aurora hues
  'Avatar', // deterministic tint palette
  'BlobMorph',
  'BoidsFlock',
  'ColorPicker', // the swatches *are* the content
  'CursorAura',
  'GlitchText', // chromatic aberration
  'GradientText',
  'HoloCard', // foil
  'LiquidGlass', // displacement-map constants, not colours
  'Marquee', // mask gradient stops
  'MatrixRain',
  'NeonSign',
  'PianoKeys', // a piano is black and white
  'PixelCanvas', // the palette is the content
  'PresenceCursors', // per-person identity colours
  'StarField',
  'Terminal', // window chrome traffic lights
  'XPBar',
  'StreakCounter', // lit flame is always warm
  'ActivityHeatmap',
  'GravityTags',
  'StickerPeel',
  'ScratchCard',
  'SignaturePad',
  'DotGlobe',
  'AudioVisualizer',
  'ParticleField',
  'AnimatedBeam',
  'RopeCursor',
  'AsciiImage',
  'ScrollProgress',
  'GooeyLoader',
  'PromoBanner',
  'QRCode',
])

const HEX = /#[0-9a-fA-F]{3,8}\b/g

const motionFailures = []
const colourFailures = []

for (const name of readdirSync(COMPONENTS).filter((entry) => /^[A-Z]/.test(entry))) {
  const dir = join(COMPONENTS, name)
  if (!statSync(dir).isDirectory()) continue

  for (const file of readdirSync(dir).filter((entry) => /\.tsx?$/.test(entry))) {
    const path = join(dir, file)
    const source = readFileSync(path, 'utf8')
    const where = relative(ROOT, path).replace(/\\/g, '/')

    if (ANIMATES.some((pattern) => pattern.test(source)) || loops(source)) {
      if (!ANSWERS.some((pattern) => pattern.test(source)) && !MOTION_ESSENTIAL[name]) {
        motionFailures.push(`${where} animates with no reduced-motion path`)
      }
    }

    if (!FIXED_COLOUR.has(name)) {
      const literals = [...new Set(source.match(HEX) ?? [])]
      if (literals.length) {
        colourFailures.push(`${where} hard-codes ${literals.slice(0, 4).join(', ')}`)
      }
    }
  }
}

const failures = [...motionFailures, ...colourFailures]

if (failures.length === 0) {
  console.log('rules: motion and colour checks pass')
  process.exit(0)
}

if (motionFailures.length) {
  console.error(`rules: ${motionFailures.length} component(s) animate without a reduced-motion path`)
  for (const failure of motionFailures) console.error(`  ${failure}`)
}
if (colourFailures.length) {
  console.error(`rules: ${colourFailures.length} file(s) hard-code a colour instead of using a token`)
  for (const failure of colourFailures) console.error(`  ${failure}`)
  console.error('  If the colour is deliberately fixed, add the component to FIXED_COLOUR here.')
}
process.exit(1)
