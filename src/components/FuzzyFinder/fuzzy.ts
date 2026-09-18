/**
 * fzf’s scoring, reimplemented: a match earns points per character, more when
 * it lands on a word start, a camelCase hump or just after a path separator,
 * and more again when it continues a run; gaps cost a little to open and less
 * to extend. A dynamic program finds the placement of the query characters
 * with the best total, so "btn" in "src/Button/button.tsx" lights up the
 * boundary letters rather than the first b, t and n it happens across.
 */
export interface FuzzyFinderMatch {
  score: number
  /** Indices into the text of the matched characters, ascending. */
  indices: number[]
}

const MATCH = 16
const GAP_START = -3
const GAP_EXTEND = -1
const BOUNDARY = MATCH / 2
const BOUNDARY_WHITE = BOUNDARY + 2
const BOUNDARY_DELIMITER = BOUNDARY + 1
const CAMEL = BOUNDARY + GAP_EXTEND
const CONSECUTIVE = -(GAP_START + GAP_EXTEND)
const FIRST_CHAR = 2
const NONE = -1e9

type Kind = 0 | 1 | 2 | 3 | 4 | 5 // white, delimiter, non-word, lower, upper, digit

function kind(char: string | undefined): Kind {
  if (char === undefined || /\s/.test(char)) return 0
  if (/[/\\,:;|]/.test(char)) return 1
  if (/\d/.test(char)) return 5
  if (char !== char.toLowerCase()) return 4
  if (char !== char.toUpperCase()) return 3
  return 2
}

function bonusFor(previous: Kind, current: Kind): number {
  if (current >= 3) {
    if (previous === 0) return BOUNDARY_WHITE
    if (previous === 1) return BOUNDARY_DELIMITER
    if (previous === 2) return BOUNDARY
  }
  if ((previous === 3 && current === 4) || (previous !== 5 && current === 5)) return CAMEL
  if (current === 2 || current === 1) return BOUNDARY
  if (current === 0) return BOUNDARY_WHITE
  return 0
}

function scoreTerm(term: string, text: string): FuzzyFinderMatch | null {
  const caseSensitive = term !== term.toLowerCase()
  const haystack = caseSensitive ? text : text.toLowerCase()
  const n = term.length
  const m = text.length
  if (n === 0) return { score: 0, indices: [] }
  if (n > m) return null

  // Cheap rejection, and the window the table needs: from the first place
  // the first character can go to the last place the last one can.
  let from = -1
  let at = 0
  for (let i = 0; i < m && at < n; i++) if (haystack[i] === term[at] && (at++ === 0)) from = i
  if (at < n) return null
  let to = m - 1
  for (let i = m - 1, back = n - 1; i >= 0; i--) {
    if (haystack[i] === term[back]) {
      if (back === n - 1) to = i
      if (--back < 0) break
    }
  }

  const width = to - from + 1
  const bonus = new Int16Array(width)
  let previous = kind(text[from - 1])
  for (let j = 0; j < width; j++) {
    const current = kind(text[from + j])
    bonus[j] = bonusFor(previous, current)
    previous = current
  }

  // H[i][j]: best score with term[i] placed at text[from + j].
  // run[i][j]: the bonus of the first character in the consecutive run ending there.
  // back[i][j]: where term[i - 1] sat on that best path.
  const H = new Float64Array(n * width).fill(NONE)
  const run = new Int16Array(n * width)
  const back = new Int32Array(n * width).fill(-1)

  for (let j = 0; j < width; j++) {
    if (haystack[from + j] === term[0]) {
      H[j] = MATCH + bonus[j] * FIRST_CHAR
      run[j] = bonus[j]
    }
  }
  for (let i = 1; i < n; i++) {
    const row = i * width
    const above = row - width
    // Best of the previous row ending two or more places back, with gap costs applied.
    let gapScore = NONE
    let gapFrom = -1
    for (let j = i; j < width; j++) {
      if (j >= 2 && H[above + j - 2] > NONE && H[above + j - 2] + GAP_START >= gapScore + GAP_EXTEND) {
        gapScore = H[above + j - 2] + GAP_START
        gapFrom = j - 2
      } else if (gapScore > NONE) gapScore += GAP_EXTEND
      if (haystack[from + j] !== term[i]) continue

      let best = NONE
      if (H[above + j - 1] > NONE) {
        const chunk = Math.max(run[above + j - 1], CONSECUTIVE, bonus[j])
        best = H[above + j - 1] + MATCH + chunk
        run[row + j] = chunk
        back[row + j] = j - 1
      }
      if (gapScore > NONE && gapScore + MATCH + bonus[j] > best) {
        best = gapScore + MATCH + bonus[j]
        run[row + j] = bonus[j]
        back[row + j] = gapFrom
      }
      H[row + j] = best
    }
  }

  const last = (n - 1) * width
  let end = -1
  for (let j = 0; j < width; j++) if (H[last + j] > NONE && (end < 0 || H[last + j] > H[last + end])) end = j
  if (end < 0) return null
  const indices: number[] = new Array(n)
  for (let i = n - 1, j = end; i >= 0; i--) {
    indices[i] = from + j
    j = back[i * width + j]
  }
  return { score: H[last + end], indices }
}

/**
 * Score `text` against `query`, fzf style. Spaces separate terms that must all
 * match, in any order; an uppercase letter makes that term case-sensitive.
 * Returns null when the text does not match.
 */
export function fuzzyScore(query: string, text: string): FuzzyFinderMatch | null {
  const terms = query.trim().split(/\s+/).filter(Boolean)
  let score = 0
  const indices = new Set<number>()
  for (const term of terms) {
    const match = scoreTerm(term, text)
    if (!match) return null
    score += match.score
    match.indices.forEach((index) => indices.add(index))
  }
  return { score, indices: [...indices].sort((a, b) => a - b) }
}
