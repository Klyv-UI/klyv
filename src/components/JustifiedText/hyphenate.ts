/**
 * Liang's hyphenation algorithm, as TeX uses it.
 *
 * A pattern is letters with digits between them. Every pattern that occurs in
 * the word (with `.` marking its edges) votes on the gaps it covers; the
 * highest vote wins, and an odd winner allows a break there. The set below is a
 * compact English one — common prefixes, suffixes and consonant splits, with
 * even digits vetoing the splits English does not make. Pass the full TeX set
 * as `patterns` for dictionary-grade breaks; the algorithm does not change.
 */
const ENGLISH = `
.un1 .un2i .un2a .un2c .dis1 .mis1 .pre1 .pro1 .con1 .com1 .sub1 .over1 .under1 .inter1 .trans1 .out1 .non1
.re1c .re1p .re1s .re1t .re1m .re1f .re1v .re1q .de1s .de1c .de1f .de1t .de1v .de1p .in1 .in2i .in2t .ex1
1tion 1sion 1cian 1tial 1cial 1tious 1cious 1ment 1ness 1less 1ful 1ship 1hood 1able 1ible 1ble 1ture 1sure
1ing. 1ings. 1ity. 1ities. 1ical 1graph 1gram 1ize 1ise 1izing 1ising 1ized 1ised 1ation 1ative 1ator
.br4ing .th4ing .str4ing .spr4ing .sw4ing .sl4ing .cl4ing .fl4ing .st4ing .wr4ing .br4ings .th4ings .str4ings
b1b c1c d1d f1f g1g l1l m1m n1n p1p r1r s1s t1t z1z 2ss. 2ll. 2ff. 2ck
n1t n1d n1s n1c n1f n1v m1b m1p r1t r1d r1s r1c r1m r1n r1g r1b r1p r1v r1k r1l l1t l1d l1m l1p l1v l1k l1f
s1t s1p s1c c1t p1t g1n x1t f1t k1n b1j d1j m1n
n3s2tr 2nth 2ntr. n2sf n2sl r2st. r2th s2th 2sts 2rds 2nts. 2nds. 2rts. 2lts
`

type Patterns = Map<string, number[]>

function compile(source: string): Patterns {
  const table: Patterns = new Map()
  for (const pattern of source.split(/\s+/).filter(Boolean)) {
    const letters = pattern.replace(/\d/g, '')
    const weights: number[] = new Array(letters.length + 1).fill(0)
    let index = 0
    for (const char of pattern) {
      if (/\d/.test(char)) weights[index] = Number(char)
      else index++
    }
    table.set(letters, weights)
  }
  return table
}

const compiled = new Map<string, Patterns>()
const EXCEPTIONS: Record<string, string> = {
  typography: 'ty-pog-ra-phy',
  paragraph: 'para-graph',
  hyphenation: 'hy-phen-ation',
  something: 'some-thing',
  everything: 'every-thing',
  whitespace: 'white-space',
  understanding: 'un-der-stand-ing',
  possible: 'pos-si-ble',
  otherwise: 'other-wise',
  whatever: 'what-ever',
  language: 'lan-guage',
  internationalization: 'in-ter-na-tion-al-iza-tion',
}

export interface JustifiedTextHyphenateOptions {
  /** Liang patterns, whitespace-separated. Defaults to the compact English set. */
  patterns?: string
  /** Letters that must stay before the first break. */
  leftMin?: number
  /** Letters that must stay after the last break. */
  rightMin?: number
}

/** Split a word into the pieces it may break between: "hyphenation" → ["hy", "phen", "ation"]. */
export function hyphenate(word: string, { patterns = ENGLISH, leftMin = 2, rightMin = 3 }: JustifiedTextHyphenateOptions = {}): string[] {
  const lower = word.toLowerCase()
  if (word.length < leftMin + rightMin || !/^\p{L}+$/u.test(word)) return [word]
  if (patterns === ENGLISH && EXCEPTIONS[lower]) {
    const parts = EXCEPTIONS[lower].split('-')
    let at = 0
    return parts.map((part) => word.slice(at, (at += part.length)))
  }
  let table = compiled.get(patterns)
  if (!table) compiled.set(patterns, (table = compile(patterns)))
  const padded = `.${lower}.`
  const votes = new Array(padded.length + 1).fill(0)
  for (let start = 0; start < padded.length; start++) {
    for (let end = start + 1; end <= padded.length; end++) {
      const weights = table.get(padded.slice(start, end))
      if (!weights) continue
      weights.forEach((weight, offset) => {
        votes[start + offset] = Math.max(votes[start + offset], weight)
      })
    }
  }
  const pieces: string[] = []
  let from = 0
  for (let gap = leftMin; gap <= word.length - rightMin; gap++) {
    // votes[k] sits before padded[k]; padded is offset by the leading dot.
    if (votes[gap + 1] % 2 === 1) {
      pieces.push(word.slice(from, gap))
      from = gap
    }
  }
  pieces.push(word.slice(from))
  // A piece without a vowel, or of one letter, reads as a stutter — "interes-t-ing".
  // Fold it into the piece before, so the patterns can be loose without the breaks being.
  const merged: string[] = []
  for (const piece of pieces) {
    if (merged.length > 0 && (piece.length < 2 || !/[aeiouy]/i.test(piece))) merged[merged.length - 1] += piece
    else merged.push(piece)
  }
  return merged
}
