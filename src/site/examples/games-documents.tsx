import { useState } from 'react'
import {
  Crossword,
  FractalExplorer,
  Input,
  MathFormula,
  Minesweeper,
  PagedDocument,
  PermissionPrompt,
  SegmentedControl,
  SlidingPuzzle,
  SnakeGame,
  Sudoku,
  Text,
  TimezonePlanner,
  type CrosswordPuzzle,
  type PagedDocumentBlock,
  type PagedDocumentSize,
  type TimezonePlannerSelection,
} from 'klyvui'
import type { ExampleModule } from './types'
import { rationale } from './shared'

/* ---------------------------------------------------------------- data */

const MINI: CrosswordPuzzle = {
  grid: ['SHARP', 'T#L#I', 'ELITE', 'A#G#C', 'MINCE'],
  across: {
    1: 'Keen-edged, like a new blade',
    4: 'The very best of a group',
    5: 'Chop very finely',
  },
  down: {
    1: 'What a boiling kettle gives off',
    2: 'Put in a straight line',
    3: 'One part of a jigsaw',
  },
}

const FORMULAS = [
  { label: 'fractions and roots', tex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { label: 'sum with limits', tex: '\\sum_{k=1}^{n} k^2 = \\frac{n(n+1)(2n+1)}{6}' },
  { label: 'integral', tex: '\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}' },
  { label: 'matrix', tex: 'R_\\theta = \\begin{bmatrix} \\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta \\end{bmatrix}' },
  { label: 'cases and text', tex: '|x| = \\begin{cases} x & \\text{if } x \\ge 0 \\\\ -x & \\text{otherwise} \\end{cases}' },
  { label: 'limits and Greek', tex: '\\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^n = e \\approx 2.718' },
]

const paragraph = (text: string) => <p className="m-0 mb-3 text-[12.5px] leading-[1.6] text-ink-soft">{text}</p>
const heading = (text: string, level: 2 | 3 = 2) =>
  level === 2 ? (
    <h2 className="m-0 mb-2 mt-4 text-[17px] font-extrabold text-ink">{text}</h2>
  ) : (
    <h3 className="m-0 mb-1.5 mt-3 text-[13.5px] font-bold text-ink">{text}</h3>
  )

const USAGE = [
  ['Compute hours', '12,480', '£3,120.00'],
  ['Object storage (TB-month)', '41.2', '£824.00'],
  ['Egress (TB)', '18.7', '£1,122.00'],
  ['Support — Business', '1', '£600.00'],
]

const REPORT: PagedDocumentBlock[] = [
  {
    id: 'title',
    content: (
      <div className="mb-6 border-b-2 border-ink pb-4">
        <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Quarterly infrastructure review</p>
        <h1 className="m-0 mt-1 text-[26px] font-extrabold tracking-tight text-ink">Q3 platform costs</h1>
        <p className="m-0 mt-2 text-[12px] text-ink-soft">Prepared for the finance and platform leads · 30 September</p>
      </div>
    ),
  },
  { id: 'h-summary', keepWithNext: true, content: heading('Summary') },
  { id: 'p1', content: paragraph('Spend rose eleven per cent on the quarter, almost entirely from egress. Compute is flat despite a twenty per cent rise in requests, which is the autoscaling work paying off; storage grew in line with retained data and needs no action.') },
  { id: 'p2', content: paragraph('The recommendation is to move the public asset bucket behind the CDN before the October release. On current traffic that removes roughly two thirds of the egress bill, and it also shortens time to first byte for readers outside Europe.') },
  { id: 'h-usage', keepWithNext: true, content: heading('Usage and charges') },
  {
    id: 'table',
    content: (
      <table className="mb-4 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-ink text-left text-[10px] uppercase tracking-wider text-ink-faint">
            <th className="py-1.5 font-bold">Item</th>
            <th className="py-1.5 text-right font-bold">Quantity</th>
            <th className="py-1.5 text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {USAGE.map(([item, quantity, amount]) => (
            <tr key={item} className="border-b border-line">
              <td className="py-1.5 text-ink">{item}</td>
              <td className="py-1.5 text-right tabular text-ink-soft">{quantity}</td>
              <td className="py-1.5 text-right tabular text-ink">{amount}</td>
            </tr>
          ))}
          <tr>
            <td className="pt-2 font-bold text-ink" colSpan={2}>
              Total
            </td>
            <td className="pt-2 text-right font-bold tabular text-ink">£5,666.00</td>
          </tr>
        </tbody>
      </table>
    ),
  },
  ...['Compute', 'Storage', 'Egress', 'Support'].flatMap((name, index): PagedDocumentBlock[] => [
    { id: `h-${name}`, keepWithNext: true, content: heading(name, 3) },
    {
      id: `p-${name}-1`,
      content: paragraph(
        [
          'Instance hours held steady at about twelve and a half thousand. The move to smaller, more numerous workers cut idle time overnight, and the batch jobs now run on spot capacity with a fallback to on-demand when the pool is exhausted.',
          'Retained data grew by six terabytes, matching the new ninety-day log retention. Lifecycle rules move anything older than thirty days to the infrequent-access tier, so the growth costs about half of what it would at the standard rate.',
          'Egress is the line that moved: 18.7 TB against 11.2 TB last quarter. Nine tenths of it is the public asset bucket serving images directly, which the CDN change addresses.',
          'Business support was used twice this quarter, both times for the database failover in August. Response times were within the agreement in both cases.',
        ][index],
      ),
    },
    {
      id: `p-${name}-2`,
      content: paragraph(
        'Figures are taken from the provider’s cost explorer on the first working day after the quarter closed, and exclude tax. Credits applied during the quarter are shown against the month they were issued, not the month they were earned.',
      ),
    },
  ]),
  { id: 'h-next', keepWithNext: true, content: heading('Next quarter') },
  { id: 'p-next', content: paragraph('Put the asset bucket behind the CDN; review reserved capacity for the database tier before the renewal in November; and add a budget alert at ninety per cent of the forecast so the next surprise arrives as an email rather than an invoice.') },
  { id: 'appendix', breakBefore: true, keepWithNext: true, content: heading('Appendix: method') },
  { id: 'p-appendix', content: paragraph('Costs are grouped by the tag on each resource. Untagged resources, about two per cent of spend, are allocated in proportion to tagged spend. Currency is converted at the rate on the invoice date.') },
]

/* ----------------------------------------------------------- specimens */

function FractalExample() {
  const [constant, setConstant] = useState('')
  return (
    <div className="flex w-full flex-col gap-2">
      <FractalExplorer onJuliaConstantChange={(point) => setConstant(`${point.re.toFixed(4)} ${point.im < 0 ? '−' : '+'} ${Math.abs(point.im).toFixed(4)}i`)} />
      <Text size="caption" tone="faint" leading="normal">
        Click anywhere on the Mandelbrot set to pick the Julia constant{constant ? ` — last picked: ${constant}` : ''}. Points near the boundary give the most intricate Julia sets.
      </Text>
    </div>
  )
}

function SudokuExample() {
  const [solved, setSolved] = useState('')
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Sudoku onSolve={(result) => setSolved(`Solved a ${result.difficulty} puzzle in ${result.seconds}s with ${result.hints} hints.`)} />
      {solved && <Text size="caption" tone="soft">{solved}</Text>}
    </div>
  )
}

function SlidingExample() {
  return (
    <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
      <SlidingPuzzle label="Fifteen puzzle" />
      <SlidingPuzzle size={3} imageTiles label="Picture puzzle" />
    </div>
  )
}

function MathEditorExample() {
  const [tex, setTex] = useState('e^{i\\pi} + 1 = 0')
  const [error, setError] = useState('')
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-ink-soft">TeX source</span>
        <Input value={tex} onChange={(event) => setTex(event.target.value)} spellCheck={false} className="font-mono" />
      </label>
      <div className="min-h-16 rounded-[var(--radius-tile)] border border-line bg-surface px-4">
        <MathFormula tex={tex} display onError={setError} />
      </div>
      <Text size="caption" tone="faint">
        {error ? 'The error is shown in place, with the position marked.' : 'Try \\frac{1}{2}, \\sqrt[3]{x}, \\sum_{i=0}^n or \\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}.'}
      </Text>
    </div>
  )
}

function InlineMathExample() {
  return (
    <p className="m-0 max-w-[60ch] text-[14px] leading-relaxed text-ink">
      For a right triangle with legs <MathFormula tex="a" /> and <MathFormula tex="b" />, the hypotenuse is{' '}
      <MathFormula tex="c = \sqrt{a^2 + b^2}" />, and the angle opposite <MathFormula tex="a" /> is{' '}
      <MathFormula tex="\theta = \arctan\frac{a}{b}" />.
    </p>
  )
}

function TimezoneExample() {
  const [selection, setSelection] = useState<TimezonePlannerSelection | null>(null)
  return (
    <div className="flex w-full flex-col gap-2">
      <TimezonePlanner onSelectionChange={setSelection} />
      {selection && (
        <Text size="caption" tone="faint" tabular>
          In UTC: {selection.start.toISOString().slice(11, 16)}–{selection.end.toISOString().slice(11, 16)}
        </Text>
      )}
    </div>
  )
}

function PermissionExample() {
  const [dismissed, setDismissed] = useState(false)
  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
      {dismissed ? (
        <Text size="caption" tone="soft">
          Dismissed. A real product would offer this again later, from settings, not on the next page load.
        </Text>
      ) : (
        <PermissionPrompt
          permission="notifications"
          title="Know when your export is ready"
          reason="Large exports take a few minutes. We’ll send one notification when the file is ready, and nothing else unless you ask."
          allowLabel="Turn on notifications"
          onDismiss={() => setDismissed(true)}
        />
      )}
      <PermissionPrompt
        permission="camera"
        title="Scan a receipt"
        reason="Point your camera at a receipt and we’ll fill in the amount and date. Nothing is recorded; the image stays on this device."
        allowLabel="Use camera"
      />
    </div>
  )
}

function PagedExample() {
  const [size, setSize] = useState<PagedDocumentSize>('a4')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Paper"
        size="sm"
        className="self-start"
        value={size}
        onValueChange={setSize}
        options={[
          { value: 'a4', label: 'A4' },
          { value: 'letter', label: 'US Letter' },
        ]}
      />
      <PagedDocument
        title="Q3 platform costs"
        size={size}
        blocks={REPORT}
        header={({ page }) => (page === 1 ? null : <div className="flex justify-between"><span>Q3 platform costs</span><span>Confidential</span></div>)}
        footer={({ page, total }) => (
          <div className="flex justify-between">
            <span>Northwind Cloud · Finance</span>
            <span>
              Page {page} of {total}
            </span>
          </div>
        )}
      />
    </div>
  )
}

/* --------------------------------------------------------------- pages */

export const demos: ExampleModule = {
  'fractal-explorer': {
    description:
      'The Mandelbrot and Julia sets rendered by escape time on a canvas you can fly through: drag to pan, wheel or double-click to zoom, and click the Mandelbrot view to pick the constant for its Julia set. Rendering is chunked across frames — a coarse pass, then full resolution — so a thousand iterations never freeze the page, and any change cancels the render in flight. The palette is read from the colour tokens, so it follows the theme and the accent. The canvas is one tab stop: arrows pan, plus and minus zoom, Enter picks the centre as the constant.',
    sections: [
      { title: 'Explorer', Content: FractalExample },
      {
        title: 'Starting on a Julia set',
        Content: () => <FractalExplorer defaultMode="julia" defaultJuliaConstant={{ re: 0.285, im: 0.01 }} defaultIterations={240} height={280} label="Julia set explorer" />,
      },
      rationale(
        'A fractal viewer is the classic demonstration of a canvas that has to stay interactive while doing heavy per-pixel work — and most freeze the tab on every zoom.',
        'Budgeted, cancellable, progressive rendering keeps the controls responsive at any iteration count, and token colours keep it inside the theme.',
        'Maths and teaching pages, generative art sections, and as a reference for any canvas that renders more than one frame’s worth of work.',
        ['SegmentedControl', 'Slider', 'IconButton', 'Button', 'Canvas 2D'],
      ),
    ],
    props: [
      { name: 'defaultMode', type: "'mandelbrot' | 'julia'", defaultValue: "'mandelbrot'", description: 'Which set is shown first.' },
      { name: 'defaultIterations', type: 'number', defaultValue: '160', description: 'Escape-time iterations per pixel to start with; the slider changes it.' },
      { name: 'defaultJuliaConstant', type: '{ re: number; im: number }', defaultValue: '−0.8 + 0.156i', description: 'The constant c for the Julia set until one is picked.' },
      { name: 'onJuliaConstantChange', type: '(point) => void', description: 'Called when a constant is picked from the Mandelbrot view.' },
      { name: 'height', type: 'number', defaultValue: '360', description: 'Canvas height in pixels; the width fills the container.' },
      { name: 'label', type: 'string', defaultValue: "'Fractal explorer'", description: 'Accessible name for the canvas.' },
    ],
  },

  sudoku: {
    description:
      'A playable sudoku with puzzles generated on the spot. A random grid is filled by backtracking, then clues are removed one at a time and put back whenever the solver finds a second answer, so every puzzle has exactly one solution. Type digits, press N for pencil notes, and conflicts in the row, column or box show as you go; Check marks wrong-but-legal digits only when you ask, and Hint fills one square. The board is an ARIA grid whose cells are named by row, column and box.',
    sections: [
      { title: 'Play', Content: SudokuExample },
      rationale(
        'Sudoku widgets usually ship a handful of fixed puzzles, and many never check that a puzzle has only one answer — which makes it unsolvable by reasoning.',
        'A real generator with a uniqueness check means endless puzzles at a chosen difficulty, and the grid semantics make it playable without seeing the thick lines.',
        'Engagement and break screens, onboarding games, and as a worked example of an editable ARIA grid.',
        ['SegmentedControl', 'Button', 'ARIA grid'],
      ),
    ],
    props: [
      { name: 'defaultDifficulty', type: "'easy' | 'medium' | 'hard'", defaultValue: "'easy'", description: 'Difficulty of the first puzzle — 38, 31 or about 25 clues.' },
      { name: 'puzzle', type: 'string', description: '81 characters, 0 or . for blanks, for a fixed puzzle. It must have one solution.' },
      { name: 'onSolve', type: '({ seconds, hints, difficulty }) => void', description: 'Called once when the grid is filled correctly.' },
    ],
  },

  minesweeper: {
    description:
      'Minesweeper that plays properly: the first click is always safe because mines are laid after it, empty regions flood open, right-click or F flags, and clicking a number whose flags are all placed chords open its other neighbours. Beginner, Intermediate and Expert presets, a mine counter and a timer. The field is an ARIA grid with one tab stop — arrows move, Enter reveals — and each cell is named by position and what is known about it; floods announce how many cells opened. Flag mode stands in for right-click on touch.',
    sections: [
      { title: 'Play', Content: () => <Minesweeper /> },
      rationale(
        'Most web minesweepers are mouse-only, lose on the first click, and give no way to chord — the move that makes larger boards playable.',
        'Correct rules plus a full keyboard model and spoken state turn a toy into a complete reference for a stateful, dense grid.',
        'Break screens and 404 pages, developer-tool easter eggs, and as a pattern for any grid where each cell has hidden state.',
        ['SegmentedControl', 'Button', 'ARIA grid'],
      ),
    ],
    props: [
      { name: 'defaultDifficulty', type: "'beginner' | 'intermediate' | 'expert'", defaultValue: "'beginner'", description: '9×9 with 10 mines, 16×16 with 40, or 30×16 with 99.' },
      { name: 'onGameEnd', type: '({ won, seconds, difficulty }) => void', description: 'Called when a game is won or lost.' },
    ],
  },

  'sliding-puzzle': {
    description:
      'The fifteen puzzle at any size. Shuffles are random but always solvable — the parity of the arrangement is checked and corrected — and clicking a tile in line with the gap slides the whole run, as the physical puzzle does. The board is one tab stop: an arrow moves the tile on that side of the gap into it. Tiles glide, or jump under reduced motion. Image mode paints a picture on a canvas from the colour tokens, so it needs no image file.',
    sections: [
      { title: 'Numbers and picture', Content: SlidingExample },
      rationale(
        'Half of all random arrangements of a sliding puzzle cannot be solved, and a shuffle that ignores this hands the reader an impossible game.',
        'The parity check guarantees every shuffle can be finished, and keyboard play with announced moves makes it usable by everyone.',
        'Loading and waiting screens, playful onboarding, and campaign pages where a picture reveals itself.',
        ['Button', 'Canvas 2D'],
      ),
    ],
    props: [
      { name: 'size', type: 'number', defaultValue: '4', description: 'Tiles per side.' },
      { name: 'imageTiles', type: 'boolean', defaultValue: 'false', description: 'Paint a generated picture across the tiles, with small numbers kept as a guide.' },
      { name: 'onSolve', type: '({ moves, seconds }) => void', description: 'Called when the tiles are back in order.' },
      { name: 'label', type: 'string', defaultValue: "'Sliding puzzle'", description: 'Accessible name for the board.' },
    ],
  },

  crossword: {
    description:
      'A crossword from data — a grid of answers with # for blocks, and clues keyed by number — with the numbering worked out from the grid. Typing fills a square and moves along the entry; Space or a second click turns the direction; Enter goes to the next clue. The clue lists follow the cursor, marking the current and the crossing clue, and choosing a clue jumps to its first empty square. Check and Reveal work on a letter, a word or the whole puzzle. Every square is a real input, so phones bring up a keyboard, and each is named with its clue numbers.',
    sections: [
      { title: 'A five-by-five', Content: () => <Crossword puzzle={MINI} label="Mini crossword" /> },
      rationale(
        'Crossword grids built from divs cannot be typed into on a phone, and the tie between a square and its clue is invisible to a screen reader.',
        'Inputs in an ARIA grid give real text entry everywhere, and naming each square by its clues makes the puzzle solvable by ear.',
        'Newsletters and publisher sites, onboarding and team games, and quizzes built from a product’s own vocabulary.',
        ['Button', 'ARIA grid', 'native inputs'],
      ),
    ],
    props: [
      { name: 'puzzle', type: 'CrosswordPuzzle', description: '{ grid: string[]; across; down } — rows of letters with # for blocks, and clue text keyed by number.' },
      { name: 'onComplete', type: '() => void', description: 'Called once when every letter is correct.' },
      { name: 'label', type: 'string', defaultValue: "'Crossword'", description: 'Accessible name for the grid.' },
    ],
  },

  'snake-game': {
    description:
      'Snake in real time on a canvas. The game advances on a fixed tick from an accumulator, so it runs at the same speed on any refresh rate, and turns are buffered — up to three, never straight back — so fast corners are not lost between ticks. Arrows or WASD steer, Space pauses, and a swipe steers on touch; it pauses itself when the tab is hidden or the board loses focus. Walls can be solid or wrap round, the speed has three levels, and the best score is kept in localStorage. Under reduced motion it still plays, without the pulsing food or the flash on death.',
    sections: [
      { title: 'Play', Content: () => <SnakeGame /> },
      rationale(
        'Real-time games tied to requestAnimationFrame run faster on fast screens, drop quick key presses, and carry on dying in a background tab.',
        'A fixed-step loop, an input buffer and automatic pausing are the three pieces every small real-time game needs, shown working together.',
        'Offline and error pages, developer easter eggs, and as a reference for any fixed-rate simulation.',
        ['SegmentedControl', 'Switch', 'Button', 'Canvas 2D'],
      ),
    ],
    props: [
      { name: 'columns / rows', type: 'number', defaultValue: '20 / 14', description: 'Board size in cells.' },
      { name: 'defaultSpeed', type: "'slow' | 'normal' | 'fast'", defaultValue: "'normal'", description: '180, 120 or 75 ms per tick.' },
      { name: 'defaultWalls', type: 'boolean', defaultValue: 'true', description: 'Solid walls; off, the snake wraps to the opposite edge.' },
      { name: 'storageKey', type: 'string | null', defaultValue: "'klyv-snake-high-score'", description: 'Where the best score is kept. null keeps it for the session only.' },
      { name: 'onGameOver', type: '(score: number) => void', description: 'Called when a game ends.' },
    ],
  },

  'math-formula': {
    description:
      'Typeset maths from a TeX-like source, rendered as native MathML so the browser does the typesetting and screen readers read the structure. The parser covers fractions, square and nth roots, super- and subscripts, Greek letters, sums, products and integrals with limits, matrices and cases, operators, accents, \\left…\\right fences and \\text. A mistake in the source is shown in place with its position marked. Where the browser cannot lay out MathML, the formula is written as linear text instead, and that text is always the formula’s alttext.',
    sections: [
      { title: 'Live editor', Content: MathEditorExample },
      {
        title: 'Display mode',
        stack: true,
        specimens: FORMULAS.map(({ label, tex }) => ({ label, fill: true, node: <MathFormula tex={tex} display /> })),
      },
      { title: 'Inline, in running text', Content: InlineMathExample },
      {
        title: 'Errors and the text fallback',
        stack: true,
        specimens: [
          { label: 'unknown command', fill: true, node: <MathFormula tex="\frac{a}{b} + \alpah" /> },
          { label: 'missing brace', fill: true, node: <MathFormula tex="\sqrt{x + 1" /> },
          { label: "render='text'", fill: true, node: <MathFormula tex="x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}" render="text" display /> },
        ],
      },
      rationale(
        'Maths on the web is usually an image, a heavy typesetting library, or glyphs positioned by hand — none of which a screen reader can read as maths.',
        'MathML is now laid out natively by every major engine; a small parser in front of it gives authors TeX they already know and readers real structure.',
        'Docs and knowledge bases, pricing and finance explainers, teaching content, and anywhere a formula sits in running text.',
        ['MathML', 'Input'],
      ),
    ],
    props: [
      { name: 'tex', type: 'string', description: 'The formula in the supported TeX subset.' },
      { name: 'display', type: 'boolean', defaultValue: 'false', description: 'Own line, centred, full size. Off, it sits in running text.' },
      { name: 'render', type: "'auto' | 'mathml' | 'text'", defaultValue: "'auto'", description: 'Auto uses MathML where the browser lays it out and linear text where it cannot.' },
      { name: 'onError', type: '(message: string) => void', description: 'Called with the parse error, if any.' },
    ],
  },

  'timezone-planner': {
    description:
      'A row per time zone on one shared strip — the first city’s calendar day — for finding a meeting time that is reasonable everywhere. Offsets come from Intl for the chosen date, so planning across the week the clocks change is right, and a DST-change day really has 23 or 25 hours. Working hours are shaded in each row’s local time and the red line is now. Drag across the strip or focus it and use the arrows — Shift+arrows change the length — and every row shows the window on its own clock. Cities can be added, removed and reordered, and the summary copies as text for an invite.',
    sections: [
      { title: 'Planning a call', Content: TimezoneExample },
      rationale(
        'Scheduling across zones by mental arithmetic, or with a fixed offset table, goes wrong twice a year when clocks change on different dates in different countries.',
        'Every cell is computed from Intl for the actual instant, so the strip is correct on any date, and the selection shows the local time in every row at once.',
        'Scheduling and booking flows, team directories, on-call handover pages and event pages with a global audience.',
        ['Select', 'Input', 'IconButton', 'CopyButton', 'Intl.DateTimeFormat'],
      ),
    ],
    props: [
      { name: 'zones / defaultZones', type: 'TimezonePlannerZone[]', description: 'Rows as { timeZone, label }; controlled or uncontrolled. The first sets the day.' },
      { name: 'onZonesChange', type: '(zones) => void', description: 'Called when a row is added, removed or moved.' },
      { name: 'cities', type: 'TimezonePlannerZone[]', description: 'What the Add menu offers. Thirteen major cities by default.' },
      { name: 'defaultDate', type: 'string', defaultValue: 'today', description: 'The day to plan, as YYYY-MM-DD.' },
      { name: 'workingHours', type: '{ start: number; end: number }', defaultValue: '{ start: 9, end: 17 }', description: 'Local working hours, shaded in every row.' },
      { name: 'step', type: '15 | 30 | 60', defaultValue: '30', description: 'Slot length in minutes.' },
      { name: 'onSelectionChange', type: '({ start: Date; end: Date }) => void', description: 'Called when the meeting window changes.' },
    ],
  },

  'permission-prompt': {
    description:
      'A pre-prompt for a browser permission — notifications, location, camera, microphone or clipboard — that says what the reader gets before the browser asks, and only triggers the real prompt from its button. It reads the current state from the Permissions API and follows changes made in site settings. Granted and unsupported states say so plainly; a blocked permission gets the steps to turn it back on for the reader’s own browser and platform, since the browser will not ask again. The live cards below query your browser; the specimens use previewState.',
    sections: [
      { title: 'Live, against this browser', Content: PermissionExample },
      {
        title: 'Every state',
        specimens: [
          { label: 'prompt', node: <PermissionPrompt permission="geolocation" previewState="prompt" reason="Show cafés near you first. Your location is used once and not stored." /> },
          { label: 'granted', node: <PermissionPrompt permission="microphone" previewState="granted" reason="" /> },
          { label: 'denied', node: <PermissionPrompt permission="notifications" previewState="denied" reason="" /> },
          { label: 'unsupported', node: <PermissionPrompt permission="clipboard-read" previewState="unsupported" reason="" /> },
        ],
      },
      rationale(
        'Cold permission prompts on page load are blocked by reflex, and once blocked the site cannot ask again — the reader has to find a setting most do not know exists.',
        'Explaining first and asking on a click raises the grant rate, and when it is blocked anyway, platform-specific steps are the only way back.',
        'Before enabling notifications, location search, video calls, voice input, and paste-from-clipboard features.',
        ['Button', 'Spinner', 'Permissions API'],
      ),
    ],
    props: [
      { name: 'permission', type: "'notifications' | 'geolocation' | 'camera' | 'microphone' | 'clipboard-read'", description: 'The permission to ask for.' },
      { name: 'reason', type: 'ReactNode', description: 'What the reader gets from allowing it.' },
      { name: 'title / allowLabel', type: 'string', description: 'Heading and the button that triggers the real prompt.' },
      { name: 'onDismiss', type: '() => void', description: 'Shows a Not now button.' },
      { name: 'onStateChange', type: '(state) => void', description: 'Called with prompt, granted, denied or unsupported as it changes.' },
      { name: 'deniedInstructions', type: 'ReactNode', description: 'Replaces the built-in re-enable steps.' },
      { name: 'previewState', type: 'PermissionPromptState', description: 'Render a fixed state without touching the browser.' },
    ],
  },

  'paged-document': {
    description:
      'Content laid out on fixed-size pages — A4 or US Letter, with margins, a running header and footer, and page X of Y — for anything that will be printed or saved as a PDF. Each block is measured off-screen at the page’s content width and pages are filled in order, honouring break-before, break-after and keep-with-next, so a heading never ends a page. The preview scales to fit; the print stylesheet removes the scaling and everything around the document, so what prints is what you saw. Try Print, or switch the paper size and watch the headings move.',
    sections: [
      { title: 'A quarterly report', Content: PagedExample },
      rationale(
        'Print previews built as one long scrolling page give no idea where the breaks fall, and the browser’s own breaks leave headings orphaned at the foot of a page.',
        'Measuring blocks and paginating in the component shows the real pages on screen, and the same pages print.',
        'Invoices and receipts, contracts and statements of work, reports and certificates — anything exported to PDF.',
        ['SegmentedControl', 'Button', 'ResizeObserver', '@page'],
      ),
    ],
    props: [
      { name: 'blocks', type: 'PagedDocumentBlock[]', description: '{ id, content, breakBefore?, breakAfter?, keepWithNext? } in reading order. Blocks are never split.' },
      { name: 'title', type: 'string', description: 'Name of the document, for its landmark.' },
      { name: 'size', type: "'a4' | 'letter'", defaultValue: "'a4'", description: 'Paper size.' },
      { name: 'margins', type: 'number | { top; right; bottom; left }', defaultValue: '18', description: 'In millimetres. Header and footer sit inside the top and bottom margins.' },
      { name: 'header / footer', type: 'ReactNode | ({ page, total }) => ReactNode', defaultValue: 'footer: Page X of Y', description: 'Running content on every page.' },
      { name: 'printable', type: 'boolean', defaultValue: 'true', description: 'Owns the page when printed. Only one per page should.' },
    ],
  },
}
