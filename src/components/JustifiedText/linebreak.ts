import { hyphenate } from './hyphenate'

/** One laid-out line: its words (the last may end in a hyphen) and how far its spaces were stretched. */
export interface JustifiedTextLine {
  words: string[]
  /** Adjustment ratio: 0 is natural spacing, 1 is fully stretched, -1 fully shrunk. */
  ratio: number
  /** The line ends in a hyphen the breaker added. */
  hyphenated: boolean
  /** The paragraph’s last line, which is set ragged. */
  last: boolean
}

export interface JustifiedTextBreakOptions {
  /** Offer breaks inside words, at Liang hyphenation points. */
  hyphenate?: boolean
  /** Liang patterns to hyphenate with. Defaults to the compact English set. */
  patterns?: string
  /** Largest stretch ratio the first pass accepts before it retries looser. */
  tolerance?: number
}

type Item =
  | { kind: 'box'; w: number; text: string }
  | { kind: 'glue'; w: number; y: number; z: number }
  | { kind: 'penalty'; w: number; p: number; flagged: boolean }

const INF = 10000
const LINE_PENALTY = 10
const FLAGGED_DEMERITS = 3000
const FITNESS_DEMERITS = 100
const HYPHEN_PENALTY = 50

function itemsFor(text: string, measure: (text: string) => number, options: JustifiedTextBreakOptions): Item[] {
  const space = measure(' ')
  const hyphen = measure('-')
  const items: Item[] = []
  const words = text.split(/\s+/).filter(Boolean)
  words.forEach((word, index) => {
    const parts = /^(\P{L}*)(\p{L}+)(\P{L}*)$/u.exec(word)
    let pieces = parts && options.hyphenate ? hyphenate(parts[2], { patterns: options.patterns }) : [word]
    if (pieces.length < 2) pieces = [word]
    else if (parts) {
      pieces[0] = parts[1] + pieces[0]
      pieces[pieces.length - 1] += parts[3]
    }
    pieces.forEach((piece, at) => {
      if (at > 0) items.push({ kind: 'penalty', w: hyphen, p: HYPHEN_PENALTY, flagged: true })
      items.push({ kind: 'box', w: measure(piece), text: piece })
    })
    if (index < words.length - 1) items.push({ kind: 'glue', w: space, y: space / 2, z: space / 3 })
  })
  items.push({ kind: 'glue', w: 0, y: INF, z: 0 }, { kind: 'penalty', w: 0, p: -INF, flagged: true })
  return items
}

interface Node {
  pos: number
  fitness: number
  w: number
  y: number
  z: number
  demerits: number
  ratio: number
  flagged: boolean
  prev: Node | null
}

/** The Knuth–Plass total-fit search: breaks that minimise the paragraph’s total demerits. */
function totalFit(items: Item[], width: number, tolerance: number): { pos: number; ratio: number }[] | null {
  let active: Node[] = [{ pos: -1, fitness: 1, w: 0, y: 0, z: 0, demerits: 0, ratio: 0, flagged: false, prev: null }]
  let sumW = 0
  let sumY = 0
  let sumZ = 0

  const consider = (b: number) => {
    const item = items[b]
    const penalty = item.kind === 'penalty' ? item.p : 0
    const flagged = item.kind === 'penalty' && item.flagged && item.w > 0
    const best: (Node | null)[] = [null, null, null, null]
    const next: Node[] = []
    for (const node of active) {
      const lineW = sumW - node.w + (item.kind === 'penalty' ? item.w : 0)
      let ratio = 0
      if (lineW < width) ratio = sumY - node.y > 0 ? (width - lineW) / (sumY - node.y) : INF
      else if (lineW > width) ratio = sumZ - node.z > 0 ? (width - lineW) / (sumZ - node.z) : -INF
      if (!(ratio < -1 || penalty === -INF)) next.push(node)
      if (ratio < -1 || ratio > tolerance) continue
      const badness = 100 * Math.abs(ratio) ** 3
      let demerits = (LINE_PENALTY + badness) ** 2
      if (penalty >= 0) demerits += penalty ** 2
      else if (penalty > -INF) demerits -= penalty ** 2
      if (flagged && node.flagged) demerits += FLAGGED_DEMERITS
      const fitness = ratio < -0.5 ? 0 : ratio <= 0.5 ? 1 : ratio <= 1 ? 2 : 3
      if (Math.abs(fitness - node.fitness) > 1) demerits += FITNESS_DEMERITS
      demerits += node.demerits
      const current = best[fitness]
      if (!current || demerits < current.demerits)
        best[fitness] = { pos: b, fitness, w: 0, y: 0, z: 0, demerits, ratio, flagged, prev: node }
    }
    if (best.some(Boolean)) {
      // What the next line starts from: everything up to the break, plus the
      // glue and penalties that vanish at a line start.
      let w = sumW
      let y = sumY
      let z = sumZ
      for (let k = b; k < items.length; k++) {
        const skip = items[k]
        if (skip.kind === 'box') break
        if (skip.kind === 'glue') {
          w += skip.w
          y += skip.y
          z += skip.z
        } else if (skip.p === -INF && k > b) break
      }
      for (const node of best) if (node) next.push({ ...node, w, y, z })
    }
    active = next
  }

  for (let i = 0; i < items.length && active.length > 0; i++) {
    const item = items[i]
    if (item.kind === 'box') sumW += item.w
    else if (item.kind === 'glue') {
      if (items[i - 1]?.kind === 'box') consider(i)
      sumW += item.w
      sumY += item.y
      sumZ += item.z
    } else if (item.p < INF) consider(i)
  }

  const end = active.filter((node) => node.pos === items.length - 1).sort((a, b) => a.demerits - b.demerits)[0]
  if (!end) return null
  const breaks: { pos: number; ratio: number }[] = []
  for (let node: Node | null = end; node && node.pos >= 0; node = node.prev) breaks.unshift({ pos: node.pos, ratio: node.ratio })
  return breaks
}

function toLines(items: Item[], breaks: { pos: number; ratio: number }[]): JustifiedTextLine[] {
  let start = 0
  return breaks.map(({ pos, ratio }, index) => {
    const words: string[] = []
    let word = ''
    for (let k = start; k < pos; k++) {
      const item = items[k]
      if (item.kind === 'box') word += item.text
      else if (item.kind === 'glue' && word) {
        words.push(word)
        word = ''
      }
    }
    const end = items[pos]
    const hyphenated = end.kind === 'penalty' && end.flagged && end.w > 0
    if (word) words.push(hyphenated ? `${word}-` : word)
    start = pos + 1
    while (start < items.length && items[start].kind !== 'box') start++
    const last = index === breaks.length - 1
    return { words, ratio: last ? 0 : ratio, hyphenated, last }
  })
}

/**
 * Optimal line breaks for a paragraph, Knuth–Plass style: every feasible break
 * is weighed against every other, so a loose line early can be traded for
 * three good ones after it. Tries a strict tolerance first and relaxes it, and
 * falls back to first-fit only if no set of breaks fits at all.
 */
export function knuthPlass(
  text: string,
  measure: (text: string) => number,
  width: number,
  options: JustifiedTextBreakOptions = {},
): JustifiedTextLine[] {
  const items = itemsFor(text, measure, { hyphenate: true, ...options })
  for (const tolerance of [options.tolerance ?? 2, 5, 20, 100]) {
    const breaks = totalFit(items, width, tolerance)
    if (breaks) return toLines(items, breaks)
  }
  return firstFit(text, measure, width)
}

/** First-fit breaking without hyphens — what `text-align: justify` does in a browser. */
export function firstFit(text: string, measure: (text: string) => number, width: number): JustifiedTextLine[] {
  const space = measure(' ')
  const lines: JustifiedTextLine[] = []
  let words: string[] = []
  let natural = 0
  const push = (last: boolean) => {
    const gaps = words.length - 1
    const ratio = last || gaps === 0 ? 0 : (width - natural) / (gaps * (natural < width ? space / 2 : space / 3))
    lines.push({ words, ratio, hyphenated: false, last })
  }
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = measure(word)
    if (words.length > 0 && natural + space + w > width) {
      push(false)
      words = []
      natural = 0
    }
    natural += (words.length > 0 ? space : 0) + w
    words.push(word)
  }
  if (words.length > 0) push(true)
  return lines
}
