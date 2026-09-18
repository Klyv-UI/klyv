'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { Switch } from '../Switch'

export type WordGuessMark = 'correct' | 'present' | 'absent'

export interface WordGuessResult {
  won: boolean
  answer: string
  guesses: string[]
  hardMode: boolean
}

export interface WordGuessProps {
  /** Possible answers, all the same length. Defaults to a built-in list of five-letter words. */
  words?: string[]
  /** Extra words accepted as guesses but never chosen as the answer. */
  validGuesses?: string[]
  /** `daily` picks the same word for everyone on a date; `random` picks a new one each game. */
  mode?: 'daily' | 'random'
  /** The date that picks the daily word. Defaults to today. */
  date?: Date
  /** Fix the answer — for tests and demos. Wins over `mode`. */
  answer?: string
  /** Hard mode, controlled. Revealed hints must be used in later guesses. */
  hardMode?: boolean
  /** Hard mode, uncontrolled. */
  defaultHardMode?: boolean
  onHardModeChange?: (hardMode: boolean) => void
  /** Attempts allowed. */
  maxGuesses?: number
  /** Called once when the game is won or lost. */
  onComplete?: (result: WordGuessResult) => void
  /** Merged last, so it wins. */
  className?: string
}

const ANSWERS = `about above actor acute admit adopt adult after again agent agree ahead alarm album alert alike alive allow alone along
alter amber angel anger angle angry apart apple apply arena argue arise array aside asset audit avoid award aware badge basic beach begin
being below bench birth black blade blame blank blast blend bless blind block blood board boost booth bound brain brand brave bread break
breed brick brief bring broad brown brush build bunch burst buyer cabin cable candy carry catch cause chain chair chalk charm chart chase
cheap check chest chief child chord civic claim class clean clear clerk click cliff climb clock close cloud coach coast color couch could
count court cover craft crane crash cream crisp crowd crown curve cycle daily dance dealt death debut delay depth diary dough draft drain
drama dream dress drink drive eager early earth eight elbow elder empty enjoy enter entry equal error event every exact exist extra faint
faith false fancy feast fence fever field fifth fifty fight final flame flash fleet flock floor flour fluid focus force forge forth forum
found frame fresh front frost fruit funny ghost giant glass globe glove grace grade grain grand grant grape graph grasp grass great green
greet grief gross group guard guess guest guide habit happy harsh heart heavy hello hinge honey honor horse hotel house human humor ideal
image index inner input issue ivory jelly jewel joint judge juice karma knife knock label labor large laser later laugh layer learn lemon
level light limit linen liver local logic loose lucky lunar lunch magic major maker maple march match mayor medal media melon mercy metal
meter might minor model money month moral motor mount mouse mouth movie music naive nerve never night noble noise north novel nurse ocean
offer often olive onion opera orbit order other outer owner paint panel paper party pasta patch pause peace pearl pedal penny phase phone
photo piano piece pilot pitch place plain plane plant plate plaza point polar pound power press price pride prime print prize proof proud
prove pulse punch pupil queen query quick quiet quite radio raise rally range rapid ratio reach ready realm relax reply ridge rifle right
rival river roast robot rough round route royal rural salad sauce scale scene scope score sense serve seven shade shake shape share sharp
sheep shelf shell shift shine shirt shock shore short shown sight skill sleep slice slide smart smile smoke snake solid solve sound south
space spare spark speak speed spend spice spine split spoon sport staff stage stair stake stand start state steam steel stick still stock
stone storm story stove strip study style sugar suite sunny super sweet table taste teach thank theme thick thing think third throw tiger
title toast today topic total touch tower track trade trail train treat trend trial tribe trick truck truly trust truth twist uncle under
union unity until upper upset urban usage usual valid value vapor video visit vital vivid voice waste watch water wheat wheel where while
white whole woman world worry worth write wrong yield young youth zebra`

const EXTRA = `aback abase abate abbey abbot adieu aisle aroma arose audio beast belly berry bingo blimp bluff blurt blush boxer bravo brine broil
budge buggy bulky bumpy burly cacao cadet camel canal canoe caper carat cargo cater cello chaos cheek cheer chess chick chili chime chirp
choir chunk cider cigar cinch civil clasp cleat cling cloak clown coral crate crave crazy creek creep crest crumb crush crust cubic cumin
daisy dandy debug decal decay decoy deity delta denim dense diner ditch dizzy dodge dozen drake drawl dread dwarf eerie elite ember epoch
essay ether ethic exalt fable facet fairy feign ferry fiber fjord flair flask fling flint flirt float flood flora fluff flume flunk foamy
folly forte foyer freak friar frisk froth fudge fungi fuzzy gauge gaunt gauze gecko genre giddy girth gleam glide glint gloat gloom glory
gnome golem goose gorge gourd gravy greed grill grime groan groom grove growl gruel gruff guava guild gusto hardy haste hatch haunt haven
hazel heist hippo hoist hound hover husky hyena icing igloo inlet irony jazzy jolly joust kayak kebab khaki kiosk knack kneel koala lance
lapse latch leafy ledge lilac llama lobby lodge lofty lorry lotus lumpy lyric macaw mango mania manor marsh mauve mocha moist molar mossy
motto mound mourn mummy mural murky nasal navel nifty ninja nymph oasis otter ounce oxide paddy pansy parka pasty patio peach pecan perch
petal picky pixel pizza plaid plank pleat plumb plume plump poker poppy porch prawn prism prong prune psalm puffy quail qualm quart quash
quill quirk quota radar rainy raven rayon regal relic remix rhino rhyme risky rivet roost rowdy ruddy rugby rumba saint salsa salty sandy
satin sauna savvy scalp scarf scoop scout scrap scrub sedan serum shack shard shawl sheen shrub siege silky skate skunk slang slate sloth
slump slurp smirk snack snail snare sneak sniff snore snort snowy sober sonic spade spawn spear spell spiky spire spite spoil spore spray
squad squat squid stain stalk stamp stash steak steep stern stilt sting stomp stool stork stout strap straw stray strut stump stunt suave
sulky surge swamp swarm swear sweat swift swirl sword synth taboo tacky taffy talon tango tangy tapir tardy taunt teddy tempo tenor tepid
thief thorn thump thyme tiara tidal timid tipsy toxic trawl tread tripe trout truce tulip tumor tuner tunic tutor twang tweak twine udder
ulcer ultra unzip usher utter valet vault vegan venom verge verse vigor villa vinyl viola viper visor vogue waltz wacky wafer wagon waist
trace waive weary wedge whale whiff whisk wince witch woken wrath wreck wrist yacht yearn yeast yodel zesty zonal`

const split = (text: string) => text.split(/\s+/).filter(Boolean)
const DEFAULT_WORDS = split(ANSWERS)
const DEFAULT_EXTRA = split(EXTRA)
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const RANK: Record<WordGuessMark, number> = { absent: 1, present: 2, correct: 3 }
const EMOJI: Record<WordGuessMark, string> = { correct: '\u{1F7E9}', present: '\u{1F7E8}', absent: '⬛' }
const TILE: Record<WordGuessMark, string> = {
  correct: 'border-success bg-success text-ink-inverse',
  present: 'border-warning bg-warning text-accent-ink',
  absent: 'border-transparent bg-[color-mix(in_oklab,var(--color-ink-faint)_45%,var(--color-surface))] text-ink',
}
const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

/**
 * Two passes, which is the whole trick. Exact matches are taken first and
 * removed from the answer’s letter counts; only then are the leftovers marked
 * present, while any of that letter remain. Guessing SPOOL against FLOOR marks
 * both Os correct and the L present, and guessing SPEED against ABIDE marks
 * one E present and the other absent — the counts one-pass scoring gets wrong.
 */
export function wordGuessScore(guess: string, answer: string): WordGuessMark[] {
  const marks: WordGuessMark[] = Array.from(guess, () => 'absent')
  const left: Record<string, number> = {}
  for (let index = 0; index < guess.length; index += 1) {
    if (guess[index] === answer[index]) marks[index] = 'correct'
    else left[answer[index]] = (left[answer[index]] ?? 0) + 1
  }
  for (let index = 0; index < guess.length; index += 1) {
    if (marks[index] === 'correct' || !left[guess[index]]) continue
    marks[index] = 'present'
    left[guess[index]] -= 1
  }
  return marks
}

/** Hard mode: every green stays put, and every revealed letter is used at least as often as it was confirmed. */
function hardModeProblem(guess: string, previous: string[], answer: string) {
  const needed: Record<string, number> = {}
  for (const earlier of previous) {
    const marks = wordGuessScore(earlier, answer)
    for (let index = 0; index < earlier.length; index += 1) {
      if (marks[index] === 'correct' && guess[index] !== earlier[index]) return `${ORDINAL[index]} letter must be ${earlier[index].toUpperCase()}`
    }
    const counts: Record<string, number> = {}
    marks.forEach((mark, index) => {
      if (mark !== 'absent') counts[earlier[index]] = (counts[earlier[index]] ?? 0) + 1
    })
    for (const [letter, count] of Object.entries(counts)) needed[letter] = Math.max(needed[letter] ?? 0, count)
  }
  for (const [letter, count] of Object.entries(needed)) {
    const have = [...guess].filter((char) => char === letter).length
    if (have < count) return `Guess must contain ${count > 1 ? `${count} ` : ''}${letter.toUpperCase()}${count > 1 ? 's' : ''}`
  }
  return null
}

const DAY = 86_400_000
const dayNumber = (date: Date) => Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2024, 0, 1)) / DAY)

/**
 * A five-letter word game with the scoring done properly.
 *
 * Duplicate letters are where most clones go wrong: a one-pass scorer marks
 * every repeat of a letter yellow, promising more copies than the answer has.
 * Scoring here takes greens first and hands out yellows only from what is left
 * (see `wordGuessScore`, exported so the rule can be tested on its own).
 *
 * Hard mode checks each guess against everything revealed so far — greens in
 * place, and each found letter at least as many times as it was confirmed. The
 * daily word is chosen from the date, so everyone playing on a day gets the
 * same one. Typing works while the game has focus, the on-screen keys carry
 * their state in their names, and each result is read out letter by letter.
 */
export function WordGuess({
  words = DEFAULT_WORDS,
  validGuesses = DEFAULT_EXTRA,
  mode = 'daily',
  date,
  answer: fixed,
  hardMode: hardProp,
  defaultHardMode = false,
  onHardModeChange,
  maxGuesses = 6,
  onComplete,
  className,
}: WordGuessProps) {
  const pool = useMemo(() => words.map((word) => word.toLowerCase()), [words])
  const valid = useMemo(() => new Set([...pool, ...validGuesses.map((word) => word.toLowerCase())]), [pool, validGuesses])
  const daily = dayNumber(date ?? new Date())
  const [randomIndex, setRandomIndex] = useState<number | null>(null)
  const answer = (fixed ?? (mode === 'daily' ? pool[((daily % pool.length) + pool.length) % pool.length] : pool[randomIndex ?? 0])).toLowerCase()
  const length = answer.length

  const [hardState, setHardState] = useState(defaultHardMode)
  const hard = hardProp ?? hardState
  const [guesses, setGuesses] = useState<string[]>([])
  const [current, setCurrent] = useState('')
  const [notice, setNotice] = useState('')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLLIElement | null)[]>([])
  const reduced = usePrefersReducedMotion()
  // The latest guesses and typing, for keystrokes that land before the next render.
  const live = useRef({ guesses, typed: current })
  live.current = { guesses, typed: current }
  const setTyped = (typed: string) => {
    live.current.typed = typed
    setCurrent(typed)
  }

  // Random mode draws after mount, so server and client render the same first frame.
  useEffect(() => {
    if (mode === 'random' && !fixed) setRandomIndex(Math.floor(Math.random() * pool.length))
  }, [mode, fixed, pool.length])

  // A new answer is a new game.
  useEffect(() => {
    setGuesses([])
    setCurrent('')
    setNotice('')
    setCopied(false)
  }, [answer])

  const won = guesses.includes(answer)
  const done = won || guesses.length >= maxGuesses

  const keyState = useMemo(() => {
    const state: Record<string, WordGuessMark> = {}
    for (const guess of guesses) {
      wordGuessScore(guess, answer).forEach((mark, index) => {
        const letter = guess[index]
        if (!state[letter] || RANK[mark] > RANK[state[letter]]) state[letter] = mark
      })
    }
    return state
  }, [guesses, answer])

  const animateRow = (index: number, keyframes: Keyframe[], perTile: boolean) => {
    if (reduced) return
    const row = rowRefs.current[index]
    if (!row) return
    if (!perTile) {
      row.animate?.(keyframes, { duration: 360, easing: 'ease-in-out' })
      return
    }
    row.querySelectorAll<HTMLElement>('[data-tile]').forEach((tile, position) => {
      tile.animate?.(keyframes, { duration: 260, delay: position * 110, easing: 'ease-out', fill: 'backwards' })
    })
  }

  const reject = (text: string) => {
    setNotice(text)
    setMessage(text)
    animateRow(guesses.length, [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(0)' },
    ], false)
  }

  const submit = () => {
    const { guesses, typed: current } = live.current
    if (guesses.includes(answer) || guesses.length >= maxGuesses) return
    if (current.length < length) return reject('Not enough letters')
    if (!valid.has(current)) return reject('Not in word list')
    if (hard) {
      const problem = hardModeProblem(current, guesses, answer)
      if (problem) return reject(problem)
    }
    const next = [...guesses, current]
    const marks = wordGuessScore(current, answer)
    live.current.guesses = next
    setGuesses(next)
    setTyped('')
    setNotice('')
    const spoken = [...current].map((letter, index) => `${letter.toUpperCase()} ${marks[index]}`).join(', ')
    const isWin = current === answer
    const isLoss = !isWin && next.length >= maxGuesses
    const verdict = isWin ? ` Solved in ${next.length}.` : isLoss ? ` Out of guesses. The word was ${answer.toUpperCase()}.` : ` ${maxGuesses - next.length} left.`
    setMessage(`Guess ${next.length}: ${spoken}.${verdict}`)
    if (isWin || isLoss) {
      setNotice(isWin ? ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew'][Math.min(5, next.length - 1)] : answer.toUpperCase())
      onComplete?.({ won: isWin, answer, guesses: next, hardMode: hard })
    }
    requestAnimationFrame(() =>
      animateRow(next.length - 1, [{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }], true),
    )
  }

  const press = (key: string) => {
    const { guesses, typed } = live.current
    if (guesses.includes(answer) || guesses.length >= maxGuesses) return
    if (key === 'enter') submit()
    else if (key === 'back') setTyped(typed.slice(0, -1))
    else if (/^[a-z]$/.test(key) && typed.length < length) {
      setTyped(typed + key)
      setNotice('')
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const onControl = event.target !== rootRef.current
    // Enter on a focused key or button activates that control, not a submit.
    if (event.key === 'Enter' && !onControl) {
      event.preventDefault()
      press('enter')
    } else if (event.key === 'Backspace') {
      event.preventDefault()
      press('back')
    } else if (/^[a-zA-Z]$/.test(event.key)) {
      event.preventDefault()
      press(event.key.toLowerCase())
    }
  }

  const share = [
    `Word Guess ${fixed ? '' : mode === 'daily' ? `#${daily} ` : ''}${won ? guesses.length : 'X'}/${maxGuesses}${hard ? '*' : ''}`.replace('  ', ' '),
    '',
    ...guesses.map((guess) => wordGuessScore(guess, answer).map((mark) => EMOJI[mark]).join('')),
  ].join('\n')

  const setHard = (value: boolean) => {
    if (hardProp === undefined) setHardState(value)
    onHardModeChange?.(value)
  }

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      role="group"
      aria-label="Word guess game. Type letters, Enter to guess."
      onKeyDown={onKeyDown}
      className={cn('flex w-full max-w-[420px] flex-col items-center gap-3 rounded-[var(--radius-card)] outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus', className)}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={hard} disabled={guesses.length > 0 && !done && !hard} onChange={(event) => setHard(event.target.checked)} />
          Hard mode
        </label>
        {mode === 'random' && !fixed && (
          <Button size="sm" variant="ghost" onClick={() => setRandomIndex(Math.floor(Math.random() * pool.length))}>
            New word
          </Button>
        )}
      </div>

      <p aria-hidden="true" className={cn('m-0 min-h-[28px] rounded-[var(--radius-8)] px-3 py-1 text-[13px] font-bold', notice ? 'bg-ink text-ink-inverse' : 'invisible')}>
        {notice || ' '}
      </p>

      <ol aria-label="Guesses" className="m-0 flex list-none flex-col gap-1.5 p-0 [perspective:600px]">
        {Array.from({ length: maxGuesses }, (_, row) => {
          const guess = guesses[row] ?? (row === guesses.length ? current : '')
          const marks = guesses[row] ? wordGuessScore(guesses[row], answer) : null
          const spoken = marks
            ? `${guesses[row].toUpperCase()}: ${[...guesses[row]].map((letter, index) => `${letter.toUpperCase()} ${marks[index]}`).join(', ')}`
            : row === guesses.length && current
              ? `typing ${current.toUpperCase().split('').join(' ')}`
              : 'empty'
          return (
            <li
              key={row}
              ref={(node) => {
                rowRefs.current[row] = node
              }}
              className="flex gap-1.5"
            >
              <span className="sr-only">
                Guess {row + 1}, {spoken}
              </span>
              {Array.from({ length }, (_, col) => {
                const letter = guess[col] ?? ''
                const mark = marks?.[col]
                return (
                  <span
                    key={col}
                    data-tile
                    aria-hidden="true"
                    className={cn(
                      'flex size-[clamp(42px,12vw,58px)] items-center justify-center rounded-[var(--radius-6)] border-2 text-[clamp(20px,6vw,28px)] font-extrabold uppercase',
                      mark ? TILE[mark] : letter ? 'border-ink-faint bg-surface text-ink' : 'border-line-strong bg-surface text-ink',
                    )}
                  >
                    {letter}
                  </span>
                )
              })}
            </li>
          )
        })}
      </ol>

      <div role="group" aria-label="Keyboard" className="flex w-full flex-col gap-1.5">
        {ROWS.map((row, index) => (
          <div key={row} className="flex justify-center gap-1">
            {index === 2 && (
              <button type="button" onClick={() => press('enter')} className="h-12 rounded-[var(--radius-6)] bg-surface-muted px-2.5 text-[11px] font-bold uppercase text-ink hover:bg-line-strong focus-visible:outline-2 focus-visible:outline-focus">
                Enter
              </button>
            )}
            {[...row].map((letter) => {
              const mark = keyState[letter]
              return (
                <button
                  key={letter}
                  type="button"
                  aria-label={`${letter.toUpperCase()}${mark ? `, ${mark}` : ''}`}
                  onClick={() => press(letter)}
                  className={cn(
                    'h-12 min-w-0 flex-1 rounded-[var(--radius-6)] text-[13px] font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
                    // A ruled-out key fades rather than filling in, so the keys still in play stand out.
                    mark === 'absent' ? 'bg-transparent text-ink-faint' : mark ? TILE[mark] : 'bg-surface-muted text-ink hover:bg-line-strong',
                  )}
                >
                  {letter}
                </button>
              )
            })}
            {index === 2 && (
              <button type="button" aria-label="Delete letter" onClick={() => press('back')} className="h-12 rounded-[var(--radius-6)] bg-surface-muted px-2.5 text-[15px] font-bold text-ink hover:bg-line-strong focus-visible:outline-2 focus-visible:outline-focus">
                {'⌫'}
              </button>
            )}
          </div>
        ))}
      </div>

      {done && (
        <div className="flex w-full flex-col items-center gap-2 rounded-[var(--radius-tile)] border border-line bg-surface-sunken p-3">
          <p className="m-0 text-[13px] font-bold text-ink">{won ? `Solved in ${guesses.length}/${maxGuesses}` : `The word was ${answer.toUpperCase()}`}</p>
          <pre aria-hidden="true" className="m-0 font-sans text-[16px] leading-tight">
            {share.split('\n').slice(2).join('\n')}
          </pre>
          <Button
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(share)
                setCopied(true)
                setMessage('Result copied to the clipboard.')
              } catch {
                setMessage('Copying was blocked. Select the grid to copy it by hand.')
              }
            }}
          >
            {copied ? 'Copied' : 'Share result'}
          </Button>
        </div>
      )}

      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
