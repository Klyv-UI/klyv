/**
 * npm-style semver for SemverRange: versions with prerelease and build parts,
 * precedence, and ranges — primitives, caret, tilde, x-ranges, hyphen ranges
 * and `||` — desugared into comparator sets the way node-semver does, with
 * upper bounds written as `<2.0.0-0` so no prerelease of the next major slips
 * in. `satisfies` applies npm’s prerelease rule: a prerelease version only
 * matches a set that names a prerelease on the same major.minor.patch.
 */

export interface SemverRangeVersion {
  major: number
  minor: number
  patch: number
  prerelease: (string | number)[]
  build: string[]
  /** Canonical text, without build metadata. */
  version: string
}

export interface SemverRangeComparator {
  operator: '<' | '<=' | '>' | '>=' | '='
  version: SemverRangeVersion
}

export interface SemverRangeSet {
  /** What was written, e.g. `^1.2.3`. */
  source: string
  /** Empty means any version. */
  comparators: SemverRangeComparator[]
  /** Plain-language reading of each written part. */
  notes: string[]
}

const NUM = '0|[1-9]\\d*'
const IDENT = `(?:${NUM}|\\d*[a-zA-Z-][a-zA-Z0-9-]*)`
const VERSION = new RegExp(`^v?=?\\s*(${NUM})\\.(${NUM})\\.(${NUM})(?:-(${IDENT}(?:\\.${IDENT})*))?(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$`)
const PARTIAL = /^v?=?\s*(\*|x|X|0|[1-9]\d*)(?:\.(\*|x|X|0|[1-9]\d*)(?:\.(\*|x|X|0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?)?)?$/

function make(major: number, minor: number, patch: number, prerelease: (string | number)[] = [], build: string[] = []): SemverRangeVersion {
  const version = `${major}.${minor}.${patch}${prerelease.length ? `-${prerelease.join('.')}` : ''}`
  return { major, minor, patch, prerelease, build, version }
}

const ids = (text: string | undefined) => (text ? text.split('.').map((id) => (/^\d+$/.test(id) ? Number(id) : id)) : [])

export function parseVersion(text: string): SemverRangeVersion | null {
  const match = VERSION.exec(text.trim())
  if (!match) return null
  return make(Number(match[1]), Number(match[2]), Number(match[3]), ids(match[4]), match[5] ? match[5].split('.') : [])
}

function compareIds(a: (string | number)[], b: (string | number)[]): number {
  if (!a.length && b.length) return 1
  if (a.length && !b.length) return -1
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i]
    const y = b[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    if (typeof x === 'number' && typeof y === 'number') return x < y ? -1 : 1
    if (typeof x === 'number') return -1
    if (typeof y === 'number') return 1
    return x < y ? -1 : 1
  }
  return 0
}

/** Precedence: major, minor, patch, then prerelease (a release beats its prereleases). Build is ignored. */
export function compare(a: SemverRangeVersion, b: SemverRangeVersion): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch || compareIds(a.prerelease, b.prerelease)
}

const cmp = (operator: SemverRangeComparator['operator'], version: SemverRangeVersion): SemverRangeComparator => ({ operator, version })
const isX = (part: string | undefined) => part === undefined || part === '*' || part === 'x' || part === 'X'
const text = (c: SemverRangeComparator) => `${c.operator === '=' ? '' : c.operator}${c.version.version}`

interface PartialVersion {
  major?: number
  minor?: number
  patch?: number
  prerelease: (string | number)[]
}

function partial(textIn: string): PartialVersion | null {
  const match = PARTIAL.exec(textIn)
  if (!match) return null
  const [, ma, mi, pa, pre] = match
  // Anything after an x is an x too: 1.x.3 means 1.x.
  const major = isX(ma) ? undefined : Number(ma)
  const minor = major === undefined || isX(mi) ? undefined : Number(mi)
  const patch = minor === undefined || isX(pa) ? undefined : Number(pa)
  return { major, minor, patch, prerelease: patch === undefined ? [] : ids(pre) }
}

const floor = (p: PartialVersion) => make(p.major ?? 0, p.minor ?? 0, p.patch ?? 0, p.prerelease)

/** Desugar one written comparator into primitive comparators. */
function desugar(token: string): { comparators: SemverRangeComparator[]; note: string } | string {
  const op = /^(\^|~>?|<=|>=|<|>|=)?\s*(.*)$/.exec(token)!
  const operator = op[1] ?? ''
  const p = partial(op[2])
  if (!p) return `“${token}” is not a version or range`
  const { major, minor, patch } = p
  const exact = patch !== undefined

  if (operator === '^') {
    const lo = floor(p)
    let hi: SemverRangeVersion
    if (major === undefined) return { comparators: [], note: `${token}: any version` }
    if (major > 0 || minor === undefined) hi = make(major + 1, 0, 0, [0])
    else if (minor > 0 || patch === undefined) hi = make(0, minor + 1, 0, [0])
    else hi = make(0, 0, patch + 1, [0])
    const why = major > 0 || minor === undefined ? 'the major version stays' : minor > 0 || patch === undefined ? 'below 1.0 the minor version is treated as major' : 'below 0.1 only this exact patch'
    return { comparators: [cmp('>=', lo), cmp('<', hi)], note: `${token}: compatible changes — ${why}; from ${lo.version} up to, not including, ${hi.version.replace('-0', '')}` }
  }
  if (operator === '~' || operator === '~>') {
    if (major === undefined) return { comparators: [], note: `${token}: any version` }
    const lo = floor(p)
    const hi = minor === undefined ? make(major + 1, 0, 0, [0]) : make(major, minor + 1, 0, [0])
    return { comparators: [cmp('>=', lo), cmp('<', hi)], note: `${token}: patch-level changes${minor === undefined ? ' (any minor, as no minor was given)' : ''}; from ${lo.version} up to, not including, ${hi.version.replace('-0', '')}` }
  }
  if (major === undefined) {
    // *, x, or an operator on one: >* and <* match nothing.
    if (operator === '<' || operator === '>') return { comparators: [cmp('<', make(0, 0, 0, [0]))], note: `${token}: matches nothing` }
    return { comparators: [], note: `${token || '*'}: any version` }
  }
  if (exact) {
    const v = floor(p)
    const o = (operator || '=') as SemverRangeComparator['operator']
    const words = { '=': 'exactly', '<': 'below', '<=': 'at most', '>': 'above', '>=': 'at least' }[o]
    return { comparators: [cmp(o, v)], note: `${token}: ${words} ${v.version}` }
  }
  // x-ranges with or without an operator.
  const lo = make(major, minor ?? 0, 0)
  const next = minor === undefined ? make(major + 1, 0, 0) : make(major, minor + 1, 0)
  const nextPre = make(next.major, next.minor, next.patch, [0])
  switch (operator) {
    case '>':
      return { comparators: [cmp('>=', next)], note: `${token}: ${next.version} or above` }
    case '>=':
      return { comparators: [cmp('>=', lo)], note: `${token}: ${lo.version} or above` }
    case '<':
      return { comparators: [cmp('<', make(lo.major, lo.minor, 0, [0]))], note: `${token}: below ${lo.version}` }
    case '<=':
      return { comparators: [cmp('<', nextPre)], note: `${token}: below ${next.version}` }
    default:
      return { comparators: [cmp('>=', lo), cmp('<', nextPre)], note: `${token}: any ${minor === undefined ? `${major}.x` : `${major}.${minor}.x`} version` }
  }
}

export function parseRange(range: string): { ok: true; sets: SemverRangeSet[] } | { ok: false; error: string } {
  const sets: SemverRangeSet[] = []
  for (const raw of range.split('||')) {
    const source = raw.trim()
    const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(source)
    if (hyphen) {
      const a = partial(hyphen[1])
      const b = partial(hyphen[2])
      if (!a || a.major === undefined) return { ok: false, error: `“${hyphen[1]}” is not a version` }
      if (!b || b.major === undefined) return { ok: false, error: `“${hyphen[2]}” is not a version` }
      const lo = floor(a)
      const hi =
        b.patch !== undefined ? cmp('<=', floor(b)) : b.minor !== undefined ? cmp('<', make(b.major, b.minor + 1, 0, [0])) : cmp('<', make(b.major + 1, 0, 0, [0]))
      sets.push({ source, comparators: [cmp('>=', lo), hi], notes: [`${source}: from ${lo.version} through ${b.patch !== undefined ? floor(b).version : `the last ${b.minor !== undefined ? `${b.major}.${b.minor}` : b.major}.x release`}`] })
      continue
    }
    // Glue operators to their versions: ">= 1.2" is one comparator.
    const tokens = source.replace(/(\^|~>?|<=|>=|<|>|=)\s+/g, '$1').split(/\s+/).filter(Boolean)
    const comparators: SemverRangeComparator[] = []
    const notes: string[] = []
    for (const token of tokens.length ? tokens : ['*']) {
      const out = desugar(token)
      if (typeof out === 'string') return { ok: false, error: out }
      comparators.push(...out.comparators)
      notes.push(out.note)
    }
    sets.push({ source: source || '*', comparators, notes })
  }
  return { ok: true, sets }
}

function test(c: SemverRangeComparator, v: SemverRangeVersion) {
  const r = compare(v, c.version)
  return c.operator === '<' ? r < 0 : c.operator === '<=' ? r <= 0 : c.operator === '>' ? r > 0 : c.operator === '>=' ? r >= 0 : r === 0
}

export type SemverRangeVerdict = { ok: true; set: number } | { ok: false; reason: 'outside' | 'prerelease' }

/** Whether a version satisfies a parsed range, and which set let it in. */
export function satisfies(v: SemverRangeVersion, sets: SemverRangeSet[], includePrerelease = false): SemverRangeVerdict {
  let blockedByPrerelease = false
  for (let i = 0; i < sets.length; i++) {
    const set = sets[i]
    if (!set.comparators.every((c) => test(c, v))) continue
    if (v.prerelease.length && !includePrerelease) {
      const named = set.comparators.some(
        (c) => c.version.prerelease.length > 0 && c.version.major === v.major && c.version.minor === v.minor && c.version.patch === v.patch,
      )
      if (!named) {
        blockedByPrerelease = true
        continue
      }
    }
    return { ok: true, set: i }
  }
  return { ok: false, reason: blockedByPrerelease ? 'prerelease' : 'outside' }
}

export function maxSatisfying(versions: SemverRangeVersion[], sets: SemverRangeSet[], includePrerelease = false): SemverRangeVersion | null {
  return versions.filter((v) => satisfies(v, sets, includePrerelease).ok).sort(compare).pop() ?? null
}

/** The comparator set in npm’s own notation. */
export function formatSet(set: SemverRangeSet): string {
  return set.comparators.length ? set.comparators.map(text).join(' ') : '*'
}
