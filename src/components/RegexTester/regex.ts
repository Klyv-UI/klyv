/**
 * A small JavaScript regex tokenizer, explainer and backtracking-risk checker
 * for RegexTester. It reads the pattern the way the engine will — escapes,
 * classes, groups, quantifiers — so each token can be explained in words and
 * the shapes that backtrack exponentially can be pointed at before running.
 */

export type RegexTesterTokenKind =
  | 'literal'
  | 'escape'
  | 'class'
  | 'dot'
  | 'anchor'
  | 'backref'
  | 'group'
  | 'close'
  | 'alternation'
  | 'quantifier'

export interface RegexTesterToken {
  kind: RegexTesterTokenKind
  text: string
  start: number
  end: number
  /** Nesting depth, for indenting the explanation. */
  depth: number
  explain: string
  /** Quantifier bounds. */
  min?: number
  max?: number
  /** Group flavour. */
  group?: 'capture' | 'named' | 'non-capture' | 'lookahead' | 'negative-lookahead' | 'lookbehind' | 'negative-lookbehind'
  /** Capture number for capturing groups. */
  capture?: number
  name?: string
}

export interface RegexTesterRisk {
  severity: 'high' | 'medium'
  message: string
  start: number
  end: number
}

const ESCAPES: Record<string, string> = {
  d: 'a digit (0–9)',
  D: 'any character except a digit',
  w: 'a word character (letter, digit or _)',
  W: 'any character except a word character',
  s: 'a whitespace character',
  S: 'any character except whitespace',
  n: 'a line feed',
  r: 'a carriage return',
  t: 'a tab',
  v: 'a vertical tab',
  f: 'a form feed',
  '0': 'the NUL character',
}

const quote = (text: string) => `“${text}”`

function describeClass(body: string): string {
  const negated = body.startsWith('^')
  const inner = negated ? body.slice(1) : body
  const items: string[] = []
  for (let i = 0; i < inner.length; i++) {
    let item = inner[i]
    if (item === '\\' && i + 1 < inner.length) {
      item = inner.slice(i, i + 2)
      i++
    }
    if (inner[i + 1] === '-' && i + 2 < inner.length) {
      let to = inner[i + 2]
      let skip = 2
      if (to === '\\') {
        to = inner.slice(i + 2, i + 4)
        skip = 3
      }
      items.push(`${item}–${to}`)
      i += skip
    } else items.push(item.startsWith('\\') && ESCAPES[item[1]] ? ESCAPES[item[1]] : item === ' ' ? 'space' : item)
  }
  if (!items.length) return negated ? 'any character' : 'nothing (an empty class never matches)'
  return `${negated ? 'any character except' : 'one of'}: ${items.join(', ')}`
}

function quantifierWords(min: number, max: number, lazy: boolean) {
  const range =
    min === 0 && max === Infinity ? 'zero or more times'
    : min === 1 && max === Infinity ? 'one or more times'
    : min === 0 && max === 1 ? 'optionally (zero or one time)'
    : max === Infinity ? `${min} or more times`
    : min === max ? `exactly ${min} time${min === 1 ? '' : 's'}`
    : `between ${min} and ${max} times`
  return `${range}, ${lazy ? 'as few as possible (lazy)' : 'as many as possible (greedy)'}`
}

/** Tokenize a pattern. Returns the tokens and, if the pattern is malformed, the first problem found. */
export function tokenizeRegex(source: string, unicode = false): { tokens: RegexTesterToken[]; error?: { message: string; at: number } } {
  const tokens: RegexTesterToken[] = []
  let depth = 0
  let captures = 0
  let error: { message: string; at: number } | undefined
  const push = (token: Omit<RegexTesterToken, 'depth'>, d = depth) => tokens.push({ ...token, depth: d })
  let i = 0
  while (i < source.length) {
    const start = i
    const ch = source[i]
    if (ch === '\\') {
      const next = source[i + 1]
      if (next === undefined) {
        error ??= { message: 'The pattern ends with a lone backslash', at: i }
        break
      }
      let text = source.slice(i, i + 2)
      let explain: string
      let kind: RegexTesterTokenKind = 'escape'
      if (next === 'b' || next === 'B') {
        kind = 'anchor'
        explain = next === 'b' ? 'a word boundary' : 'a position that is not a word boundary'
      } else if (ESCAPES[next] && !(next === '0' && /\d/.test(source[i + 2] ?? ''))) explain = ESCAPES[next]
      else if (/[1-9]/.test(next)) {
        const digits = /^\d+/.exec(source.slice(i + 1))![0]
        text = `\\${digits}`
        kind = 'backref'
        explain = `the same text group ${digits} matched`
      } else if (next === 'k' && source[i + 2] === '<') {
        const close = source.indexOf('>', i)
        text = source.slice(i, close + 1)
        kind = 'backref'
        explain = `the same text the group named ${quote(source.slice(i + 3, close))} matched`
      } else if (next === 'x' && /^[\da-f]{2}/i.test(source.slice(i + 2))) {
        text = source.slice(i, i + 4)
        explain = `the character ${quote(String.fromCharCode(parseInt(text.slice(2), 16)))}`
      } else if (next === 'u' && /^\{[\da-f]+\}/i.test(source.slice(i + 2)) && unicode) {
        text = source.slice(i, source.indexOf('}', i) + 1)
        explain = `the character U+${text.slice(3, -1).toUpperCase()}`
      } else if (next === 'u' && /^[\da-f]{4}/i.test(source.slice(i + 2))) {
        text = source.slice(i, i + 6)
        explain = `the character U+${text.slice(2).toUpperCase()}`
      } else if ((next === 'p' || next === 'P') && source[i + 2] === '{') {
        text = source.slice(i, source.indexOf('}', i) + 1)
        explain = `${next === 'P' ? 'any character without' : 'a character with'} the Unicode property ${text.slice(3, -1)}`
      } else if (next === 'c' && /[a-z]/i.test(source[i + 2] ?? '')) {
        text = source.slice(i, i + 3)
        explain = `the control character Ctrl+${text[2].toUpperCase()}`
      } else {
        kind = 'literal'
        explain = `the character ${quote(next)}`
      }
      push({ kind, text, start, end: start + text.length, explain })
      i = start + text.length
      continue
    }
    if (ch === '[') {
      let j = i + 1
      if (source[j] === '^') j++
      while (j < source.length && source[j] !== ']') j += source[j] === '\\' ? 2 : 1
      if (j >= source.length) {
        error ??= { message: 'A character class is never closed with ]', at: i }
        break
      }
      const text = source.slice(i, j + 1)
      push({ kind: 'class', text, start, end: j + 1, explain: describeClass(text.slice(1, -1)) })
      i = j + 1
      continue
    }
    if (ch === '(') {
      const rest = source.slice(i)
      let text = '('
      let group: RegexTesterToken['group'] = 'capture'
      let name: string | undefined
      let explain: string
      const named = /^\(\?<([A-Za-z_$][\w$]*)>/.exec(rest)
      if (rest.startsWith('(?:')) (text = '(?:'), (group = 'non-capture')
      else if (rest.startsWith('(?=')) (text = '(?='), (group = 'lookahead')
      else if (rest.startsWith('(?!')) (text = '(?!'), (group = 'negative-lookahead')
      else if (rest.startsWith('(?<=')) (text = '(?<='), (group = 'lookbehind')
      else if (rest.startsWith('(?<!')) (text = '(?<!'), (group = 'negative-lookbehind')
      else if (named) (text = named[0]), (group = 'named'), (name = named[1])
      else if (rest.startsWith('(?')) {
        error ??= { message: 'Unknown group syntax after (?', at: i }
      }
      const capture = group === 'capture' || group === 'named' ? ++captures : undefined
      explain = {
        capture: `start of capture group ${capture}`,
        named: `start of capture group ${capture}, named ${quote(name ?? '')}`,
        'non-capture': 'start of a group that does not capture',
        lookahead: 'start of a lookahead: what follows must match here, without consuming it',
        'negative-lookahead': 'start of a negative lookahead: what follows must not match here',
        lookbehind: 'start of a lookbehind: what precedes must match',
        'negative-lookbehind': 'start of a negative lookbehind: what precedes must not match',
      }[group]
      push({ kind: 'group', text, start, end: start + text.length, explain, group, capture, name })
      depth++
      i += text.length
      continue
    }
    if (ch === ')') {
      depth--
      if (depth < 0) {
        error ??= { message: 'A ) has no ( to close', at: i }
        depth = 0
      }
      push({ kind: 'close', text: ')', start, end: i + 1, explain: 'end of the group' })
      i++
      continue
    }
    const quant = /^(?:([*+?])|\{(\d+)(,(\d*))?\})(\??)/.exec(source.slice(i))
    if (quant) {
      const prev = tokens[tokens.length - 1]
      if (!prev || prev.kind === 'group' || prev.kind === 'alternation' || prev.kind === 'quantifier' || prev.kind === 'anchor') {
        error ??= { message: `${quote(quant[0])} has nothing to repeat`, at: i }
      }
      const min = quant[1] ? (quant[1] === '+' ? 1 : 0) : Number(quant[2])
      const max = quant[1] ? (quant[1] === '?' ? 1 : Infinity) : quant[3] ? (quant[4] ? Number(quant[4]) : Infinity) : min
      if (max < min) error ??= { message: `${quote(quant[0])}: the maximum is below the minimum`, at: i }
      push({ kind: 'quantifier', text: quant[0], start, end: i + quant[0].length, explain: `repeat the previous item ${quantifierWords(min, max, quant[5] === '?')}`, min, max })
      i += quant[0].length
      continue
    }
    if (ch === '|') push({ kind: 'alternation', text: '|', start, end: i + 1, explain: 'or — try the alternative after this if the one before fails' })
    else if (ch === '^') push({ kind: 'anchor', text: '^', start, end: i + 1, explain: 'the start of the input (or of a line, with the m flag)' })
    else if (ch === '$') push({ kind: 'anchor', text: '$', start, end: i + 1, explain: 'the end of the input (or of a line, with the m flag)' })
    else if (ch === '.') push({ kind: 'dot', text: '.', start, end: i + 1, explain: 'any character except a line break (any at all, with the s flag)' })
    else push({ kind: 'literal', text: ch, start, end: i + 1, explain: ch === ' ' ? 'a space' : `the character ${quote(ch)}` })
    i++
  }
  if (depth > 0 && !error) error = { message: `${depth} group${depth > 1 ? 's are' : ' is'} never closed with )`, at: source.length }
  return { tokens: mergeLiterals(tokens), error }
}

/** Runs of plain characters read better as one piece of text, except the last one before a quantifier. */
function mergeLiterals(tokens: RegexTesterToken[]): RegexTesterToken[] {
  const out: RegexTesterToken[] = []
  tokens.forEach((token, index) => {
    const prev = out[out.length - 1]
    const nextIsQuant = tokens[index + 1]?.kind === 'quantifier'
    if (token.kind === 'literal' && token.text.length === 1 && !nextIsQuant && prev?.kind === 'literal' && prev.end === token.start && prev.depth === token.depth && !prev.text.startsWith('\\')) {
      prev.text += token.text
      prev.end = token.end
      prev.explain = `the text ${quote(prev.text)}`
    } else out.push({ ...token })
  })
  return out
}

/* ------------------------------------------------------------ risk check */

interface Node {
  kind: 'atom' | 'group'
  token: RegexTesterToken
  alts?: Node[][]
  quant?: RegexTesterToken
  end: number
}

function build(tokens: RegexTesterToken[]): Node[][] {
  let i = 0
  const seq = (): Node[][] => {
    const alts: Node[][] = [[]]
    while (i < tokens.length) {
      const token = tokens[i]
      if (token.kind === 'close') return alts
      i++
      if (token.kind === 'alternation') {
        alts.push([])
        continue
      }
      if (token.kind === 'quantifier') {
        const current = alts[alts.length - 1]
        const last = current[current.length - 1]
        if (last && !last.quant) last.quant = token
        continue
      }
      if (token.kind === 'group') {
        const inner = seq()
        const close = tokens[i]
        if (close?.kind === 'close') i++
        alts[alts.length - 1].push({ kind: 'group', token, alts: inner, end: close?.end ?? token.end })
        continue
      }
      alts[alts.length - 1].push({ kind: 'atom', token, end: token.end })
    }
    return alts
  }
  return seq()
}

const unbounded = (node: Node) => (node.quant?.max ?? 1) === Infinity
const lookaround = (node: Node) => node.kind === 'group' && /look/.test(node.token.group ?? '')

/** Characters used to decide whether two branches can start with the same thing. */
const SAMPLES = [...Array.from({ length: 95 }, (_, k) => String.fromCharCode(32 + k)), '\t', '\n', 'é', 'Ω', 'ж', '中', '٣']

/** The first character of a literal token, as regex source. */
const firstLiteral = (text: string) => (text.startsWith('\\') ? text.slice(0, 2) : text[0].replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))

/** The regex sources that can match the first character of a sequence. */
function firsts(seq: Node[]): string[] | null {
  const out: string[] = []
  for (const node of seq) {
    if (node.kind === 'atom' && (node.token.kind === 'anchor' || node.token.kind === 'backref')) continue
    if (lookaround(node)) continue
    if (node.kind === 'group') {
      for (const alt of node.alts ?? []) {
        const inner = firsts(alt)
        if (inner === null) return null
        out.push(...inner)
      }
    } else out.push(node.token.kind === 'literal' ? firstLiteral(node.token.text) : node.token.text)
    if (!node.quant || (node.quant.min ?? 0) > 0) return out
  }
  // The sequence can match nothing at all: it overlaps with everything.
  return null
}

function overlap(a: string[] | null, b: string[] | null, flags: string): boolean {
  if (a === null || b === null) return true
  const test = (sources: string[]) => {
    try {
      const re = new RegExp(`^(?:${sources.join('|')})`, flags.replace(/[gyd]/g, ''))
      return SAMPLES.filter((c) => re.test(c))
    } catch {
      return SAMPLES
    }
  }
  const left = new Set(test(a))
  return test(b).some((c) => left.has(c))
}

/**
 * Point out the shapes that make a backtracking engine go exponential: a
 * quantified group containing another unbounded quantifier — (a+)+ — and a
 * quantified alternation whose branches can start with the same character —
 * (a|ab)*. Adjacent overlapping quantifiers (\d+\d+) are polynomial and get
 * the milder warning.
 */
export function findRisks(tokens: RegexTesterToken[], flags: string): RegexTesterRisk[] {
  const risks: RegexTesterRisk[] = []
  const walk = (alts: Node[][]) => {
    for (const seq of alts) {
      seq.forEach((node, index) => {
        if (node.kind === 'group' && unbounded(node) && !lookaround(node)) {
          // Nested quantifiers are only ambiguous when an inner repeat can run
          // on into the next repetition: nothing required follows it, and it
          // can match how the group starts. (a+)+ and (\w+\s?)* qualify;
          // (\.\w+)+ does not, because each repetition must begin with a dot.
          for (const body of node.alts ?? []) {
            const head = firsts(body)
            const inner = body.find((item, k) => unbounded(item) && !lookaround(item) && body.slice(k + 1).every((rest) => (rest.quant?.min ?? 1) === 0 || rest.kind === 'atom' && rest.token.kind === 'anchor') && overlap(firsts([item]), head, flags))
            if (inner) {
              risks.push({
                severity: 'high',
                message: `Nested quantifiers: ${inner.token.text}${inner.kind === 'group' ? '…)' : ''}${inner.quant?.text} can run on into the next repetition of the group around it (${node.quant?.text}). On text that almost matches, the engine tries every way of dividing it between the two — exponential time.`,
                start: node.token.start,
                end: node.quant?.end ?? node.end,
              })
              break
            }
          }
        }
        if (node.kind === 'group' && unbounded(node) && (node.alts?.length ?? 0) > 1) {
          const branches = node.alts!.map(firsts)
          for (let a = 0; a < branches.length; a++) {
            for (let b = a + 1; b < branches.length; b++) {
              if (overlap(branches[a], branches[b], flags)) {
                risks.push({
                  severity: 'high',
                  message: `Overlapping alternation under ${node.quant?.text}: branches ${a + 1} and ${b + 1} can match the same character, so each repetition can take either — exponential time on a failing match.`,
                  start: node.token.start,
                  end: node.quant?.end ?? node.end,
                })
                a = branches.length
                break
              }
            }
          }
        }
        const next = seq[index + 1]
        if (next && unbounded(node) && unbounded(next) && node.kind === 'atom' && next.kind === 'atom' && overlap(firsts([node]), firsts([next]), flags)) {
          risks.push({
            severity: 'medium',
            message: `${node.token.text}${node.quant?.text} then ${next.token.text}${next.quant?.text} can divide the same run of characters many ways — polynomial slowdown on long input that fails to match.`,
            start: node.token.start,
            end: next.quant?.end ?? next.end,
          })
        }
        if (node.kind === 'group') walk(node.alts ?? [])
      })
    }
  }
  walk(build(tokens))
  // One report per spot is enough.
  return risks.filter((risk, index) => risks.findIndex((other) => other.start === risk.start && other.message.slice(0, 20) === risk.message.slice(0, 20)) === index)
}

/* ------------------------------------------------------------- matching */

export interface RegexTesterMatch {
  index: number
  text: string
  /** Numbered groups, in order; `undefined` where a group did not take part. */
  groups: (string | undefined)[]
  /** Named groups, if any. */
  named: Record<string, string | undefined> | null
}

export interface RegexTesterRunResult {
  ok: boolean
  matches: RegexTesterMatch[]
  capped: boolean
  error?: string
  ms: number
}

/**
 * The matcher. It is self-contained on purpose: RegexTester turns it into the
 * source of a Worker with `toString()`, and also calls it directly when there
 * are no Workers. It gives up after `max` matches and — between exec calls —
 * after `budget` milliseconds. A single catastrophic exec cannot be interrupted
 * from inside, which is why the Worker exists: the page terminates it from
 * outside.
 */
export function runRegex(source: string, flags: string, text: string, max: number, budget: number): RegexTesterRunResult {
  const started = Date.now()
  const matches: RegexTesterMatch[] = []
  let capped = false
  try {
    const re = new RegExp(source, flags)
    const repeat = re.global || re.sticky
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      matches.push({ index: m.index, text: m[0], groups: Array.prototype.slice.call(m, 1), named: m.groups ? Object.assign({}, m.groups) : null })
      if (!repeat) break
      if (matches.length >= max || Date.now() - started > budget) {
        capped = true
        break
      }
      if (m[0] === '') {
        const code = text.codePointAt(re.lastIndex)
        re.lastIndex += re.unicode && code !== undefined && code > 0xffff ? 2 : 1
      }
    }
    return { ok: true, matches, capped, ms: Date.now() - started }
  } catch (error) {
    return { ok: false, matches: [], capped: false, error: error instanceof Error ? error.message : String(error), ms: 0 }
  }
}
