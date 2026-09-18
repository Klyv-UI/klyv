/**
 * A client-side inverted index with BM25 ranking.
 *
 * Text is split into words, lowercased, stripped of stop words and reduced to
 * stems with the Porter algorithm, so "configuring" finds "configured". Each
 * stem maps to the documents and fields it occurs in. A query is scored with
 * BM25 per field — rare words weigh more, repeats saturate, long fields are
 * normalised — and the fields are summed with their boosts. The last word of
 * a query also matches as a prefix, so results arrive while it is still being
 * typed.
 */

const STOP = new Set(
  'a about above after again against all am an and any are as at be because been before being below between both but by can did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with you your'.split(' '),
)

/* ----------------------------------------------------------- porter stemmer */

const vowelAt = (word: string, i: number): boolean =>
  /[aeiou]/.test(word[i]) || (word[i] === 'y' && i > 0 && !vowelAt(word, i - 1))

/** The number of vowel-consonant sequences, Porter’s m. */
function measure(stem: string): number {
  let m = 0
  let previousVowel = false
  for (let i = 0; i < stem.length; i++) {
    const vowel = vowelAt(stem, i)
    if (previousVowel && !vowel) m++
    previousVowel = vowel
  }
  return m
}
const hasVowel = (stem: string) => [...stem].some((_, i) => vowelAt(stem, i))
const doubleConsonant = (word: string) =>
  word.length > 1 && word[word.length - 1] === word[word.length - 2] && !vowelAt(word, word.length - 1)
const cvc = (word: string) => {
  const n = word.length
  return n >= 3 && !vowelAt(word, n - 3) && vowelAt(word, n - 2) && !vowelAt(word, n - 1) && !/[wxy]/.test(word[n - 1])
}

function replace(word: string, rules: [string, string][], minimum: number): string {
  for (const [suffix, replacement] of rules) {
    if (word.endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length)
      return measure(stem) > minimum ? stem + replacement : word
    }
  }
  return word
}

const STEP2: [string, string][] = [
  ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'], ['izer', 'ize'], ['abli', 'able'],
  ['alli', 'al'], ['entli', 'ent'], ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
  ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'], ['ousness', 'ous'], ['aliti', 'al'],
  ['iviti', 'ive'], ['biliti', 'ble'],
]
const STEP3: [string, string][] = [
  ['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'], ['ical', 'ic'], ['ful', ''], ['ness', ''],
]
const STEP4 = ['al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement', 'ment', 'ent', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize']

/** Porter’s stemmer, steps 1 to 5: "relational" → "relat", "searching" → "search". */
export function porterStem(input: string): string {
  let word = input
  if (word.length < 3) return word
  // 1a
  if (word.endsWith('sses')) word = word.slice(0, -2)
  else if (word.endsWith('ies')) word = word.slice(0, -2)
  else if (!word.endsWith('ss') && word.endsWith('s')) word = word.slice(0, -1)
  // 1b
  let tidy = false
  if (word.endsWith('eed')) {
    if (measure(word.slice(0, -3)) > 0) word = word.slice(0, -1)
  } else if (word.endsWith('ed') && hasVowel(word.slice(0, -2))) {
    word = word.slice(0, -2)
    tidy = true
  } else if (word.endsWith('ing') && hasVowel(word.slice(0, -3))) {
    word = word.slice(0, -3)
    tidy = true
  }
  if (tidy) {
    if (/(at|bl|iz)$/.test(word)) word += 'e'
    else if (doubleConsonant(word) && !/[lsz]$/.test(word)) word = word.slice(0, -1)
    else if (measure(word) === 1 && cvc(word)) word += 'e'
  }
  // 1c
  if (word.endsWith('y') && hasVowel(word.slice(0, -1))) word = `${word.slice(0, -1)}i`
  word = replace(word, STEP2, 0)
  word = replace(word, STEP3, 0)
  // 4
  for (const suffix of STEP4) {
    if (!word.endsWith(suffix)) continue
    const base = word.slice(0, -suffix.length)
    if (measure(base) > 1) word = base
    break
  }
  if (word.endsWith('ion')) {
    const base = word.slice(0, -3)
    if (measure(base) > 1 && /[st]$/.test(base)) word = base
  }
  // 5
  if (word.endsWith('e')) {
    const base = word.slice(0, -1)
    const m = measure(base)
    if (m > 1 || (m === 1 && !cvc(base))) word = base
  }
  if (measure(word) > 1 && doubleConsonant(word) && word.endsWith('l')) word = word.slice(0, -1)
  return word
}

/* ------------------------------------------------------------- tokeniser */

export interface FullTextSearchToken {
  /** The word as written. */
  text: string
  /** Its stem, or null for a stop word. */
  term: string | null
  start: number
  end: number
}

export function fullTextTokenize(text: string): FullTextSearchToken[] {
  const tokens: FullTextSearchToken[] = []
  for (const match of text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu)) {
    const lower = match[0].toLowerCase().replace(/['’]s$/, '')
    tokens.push({ text: match[0], term: STOP.has(lower) ? null : porterStem(lower), start: match.index!, end: match.index! + match[0].length })
  }
  return tokens
}

/* ----------------------------------------------------------------- index */

export interface FullTextSearchDocument {
  id: string
  title: string
  body: string
  /** Anything else to carry through to results. */
  [field: string]: unknown
}

export interface FullTextSearchHit<D extends FullTextSearchDocument = FullTextSearchDocument> {
  document: D
  score: number
  /** The index terms the query matched in this document */
  terms: string[]
}

export interface FullTextSearchIndexOptions {
  /** Searched fields and their weights. Defaults to title ×3, body ×1. */
  fields?: Record<string, number>
  /** BM25 term-frequency saturation. */
  k1?: number
  /** BM25 length normalisation, 0 to 1. */
  b?: number
}

export class FullTextSearchIndex<D extends FullTextSearchDocument = FullTextSearchDocument> {
  private fields: [string, number][]
  private k1: number
  private b: number
  private docs = new Map<string, { doc: D; lengths: number[]; terms: Set<string> }>()
  private postings = new Map<string, Map<string, number[]>>()
  private totals: number[]
  private sorted: string[] | null = null

  constructor({ fields = { title: 3, body: 1 }, k1 = 1.2, b = 0.75 }: FullTextSearchIndexOptions = {}) {
    this.fields = Object.entries(fields)
    this.k1 = k1
    this.b = b
    this.totals = this.fields.map(() => 0)
  }

  get size() {
    return this.docs.size
  }

  has(id: string) {
    return this.docs.has(id)
  }

  get(id: string) {
    return this.docs.get(id)?.doc
  }

  add(doc: D) {
    if (this.docs.has(doc.id)) this.remove(doc.id)
    const lengths: number[] = []
    const terms = new Set<string>()
    this.fields.forEach(([field], f) => {
      const tokens = fullTextTokenize(String(doc[field] ?? '')).filter((token) => token.term)
      lengths.push(tokens.length)
      this.totals[f] += tokens.length
      for (const { term } of tokens) {
        let posting = this.postings.get(term!)
        if (!posting) this.postings.set(term!, (posting = new Map()))
        let counts = posting.get(doc.id)
        if (!counts) posting.set(doc.id, (counts = this.fields.map(() => 0)))
        counts[f]++
        terms.add(term!)
      }
    })
    this.docs.set(doc.id, { doc, lengths, terms })
    this.sorted = null
  }

  remove(id: string) {
    const entry = this.docs.get(id)
    if (!entry) return
    entry.lengths.forEach((length, f) => (this.totals[f] -= length))
    for (const term of entry.terms) {
      const posting = this.postings.get(term)
      posting?.delete(id)
      if (posting?.size === 0) this.postings.delete(term)
    }
    this.docs.delete(id)
    this.sorted = null
  }

  /** Index terms starting with `prefix`, by binary search over the sorted vocabulary. */
  private expand(prefix: string): string[] {
    this.sorted ??= [...this.postings.keys()].sort()
    const list = this.sorted
    let low = 0
    let high = list.length
    while (low < high) {
      const mid = (low + high) >> 1
      if (list[mid] < prefix) low = mid + 1
      else high = mid
    }
    const found: string[] = []
    for (let i = low; i < list.length && list[i].startsWith(prefix) && found.length < 50; i++) found.push(list[i])
    return found
  }

  /** The stems a query searches for, with the last word widened to a prefix when `prefix` is on. */
  queryTerms(query: string, prefix = true): { term: string; weight: number }[] {
    const tokens = fullTextTokenize(query)
    const open = prefix && /[\p{L}\p{N}]$/u.test(query)
    const wanted = new Map<string, number>()
    tokens.forEach((token, index) => {
      const last = index === tokens.length - 1
      if (last && open) {
        const raw = token.text.toLowerCase()
        if (token.term) wanted.set(token.term, 1)
        for (const term of this.expand(raw)) if (!wanted.has(term)) wanted.set(term, term === raw ? 1 : 0.7)
      } else if (token.term) wanted.set(token.term, 1)
    })
    return [...wanted].map(([term, weight]) => ({ term, weight }))
  }

  search(query: string, { limit = 20, prefix = true }: { limit?: number; prefix?: boolean } = {}): FullTextSearchHit<D>[] {
    const n = this.docs.size
    if (n === 0) return []
    const averages = this.totals.map((total) => total / n || 1)
    const scores = new Map<string, { score: number; terms: string[] }>()
    for (const { term, weight } of this.queryTerms(query, prefix)) {
      const posting = this.postings.get(term)
      if (!posting) continue
      const idf = Math.log(1 + (n - posting.size + 0.5) / (posting.size + 0.5))
      posting.forEach((counts, id) => {
        const { lengths } = this.docs.get(id)!
        let score = 0
        this.fields.forEach(([, boost], f) => {
          const tf = counts[f]
          if (!tf) return
          const norm = 1 - this.b + (this.b * lengths[f]) / averages[f]
          score += boost * ((tf * (this.k1 + 1)) / (tf + this.k1 * norm))
        })
        const entry = scores.get(id) ?? { score: 0, terms: [] }
        entry.score += weight * idf * score
        entry.terms.push(term)
        scores.set(id, entry)
      })
    }
    return [...scores]
      .map(([id, { score, terms }]) => ({ document: this.docs.get(id)!.doc, score, terms }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }
}

/**
 * The passage of `text` with the most distinct matched terms, as ranges to
 * mark. Words, not characters, set the window, so a snippet never cuts one.
 */
export function fullTextSnippet(text: string, terms: Iterable<string>, words = 26): { text: string; marks: [number, number][]; clipped: [boolean, boolean] } {
  const wanted = new Set(terms)
  const tokens = fullTextTokenize(text)
  if (tokens.length === 0) return { text: '', marks: [], clipped: [false, false] }
  const hit = tokens.map((token) => (token.term && wanted.has(token.term) ? token.term : null))
  let best = 0
  let bestScore = -1
  for (let start = 0; start < Math.max(1, tokens.length - words + 1); start++) {
    const seen = new Set(hit.slice(start, start + words).filter(Boolean))
    const score = seen.size * 10 - (hit[start] ? 0 : 1)
    if (score > bestScore) {
      bestScore = score
      best = start
    }
  }
  // Start a couple of words before the first hit, so it reads in context.
  const firstHit = hit.findIndex((term, index) => index >= best && term)
  const from = Math.max(0, Math.min(best, firstHit < 0 ? best : firstHit - 3))
  const to = Math.min(tokens.length, from + words)
  const begin = tokens[from].start
  const end = tokens[to - 1].end
  const marks: [number, number][] = []
  for (let i = from; i < to; i++) if (hit[i]) marks.push([tokens[i].start - begin, tokens[i].end - begin])
  return { text: text.slice(begin, end), marks, clipped: [from > 0, to < tokens.length] }
}
