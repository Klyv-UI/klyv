/**
 * A JSONPath parser and evaluator for JsonQuery, close to RFC 9535: `$`,
 * dot and bracket child names, `*`, recursive descent `..`, indexes (negative
 * from the end), slices with steps, unions, and filters. Filters are parsed
 * into a small expression tree and evaluated by walking it — there is no
 * `eval` and no `Function`, so a query can only read the data it is given.
 */

export type JsonQueryPathPart = string | number

export interface JsonQueryResult {
  /** Normalised path, e.g. `$['store']['book'][0]`. */
  path: string
  /** The same location as parts, for highlighting. */
  parts: JsonQueryPathPart[]
  value: unknown
}

export interface JsonQueryError {
  message: string
  /** 0-based character position in the expression. */
  at: number
}

export type JsonQuerySelector =
  | { kind: 'name'; name: string }
  | { kind: 'wildcard' }
  | { kind: 'index'; index: number }
  | { kind: 'slice'; start?: number; end?: number; step?: number }
  | { kind: 'filter'; expr: JsonQueryExpr }

export interface JsonQuerySegment {
  descendant: boolean
  selectors: JsonQuerySelector[]
}

export type JsonQueryExpr =
  | { t: 'lit'; value: unknown }
  | { t: 'regex'; re: RegExp }
  | { t: 'path'; root: '@' | '$'; segments: JsonQuerySegment[] }
  | { t: 'not'; e: JsonQueryExpr }
  | { t: 'and' | 'or'; a: JsonQueryExpr; b: JsonQueryExpr }
  | { t: 'cmp'; op: string; a: JsonQueryExpr; b: JsonQueryExpr }
  | { t: 'fn'; name: 'length' | 'count'; arg: JsonQueryExpr }

class Fail extends Error {
  constructor(message: string, readonly at: number) {
    super(message)
  }
}

const NAME_START = /[A-Za-z_$\u0080-\uffff]/
const NAME_CHAR = /[\w$\u0080-\uffff-]/

class Parser {
  i = 0
  constructor(readonly src: string) {}

  peek(n = 0) {
    return this.src[this.i + n]
  }
  ws() {
    while (/\s/.test(this.peek() ?? '')) this.i++
  }
  eat(text: string) {
    if (this.src.startsWith(text, this.i)) {
      this.i += text.length
      return true
    }
    return false
  }
  expect(text: string, what = `“${text}”`) {
    this.ws()
    if (!this.eat(text)) throw new Fail(`Expected ${what}${this.peek() ? ` but found “${this.peek()}”` : ' but the expression ended'}`, this.i)
  }

  name(): string {
    const start = this.i
    if (!NAME_START.test(this.peek() ?? '')) throw new Fail(this.peek() ? `A name cannot start with “${this.peek()}”` : 'Expected a name', this.i)
    while (NAME_CHAR.test(this.peek() ?? '')) this.i++
    return this.src.slice(start, this.i)
  }

  string(): string {
    const quote = this.peek()
    const start = this.i
    this.i++
    let out = ''
    while (this.i < this.src.length && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.i++
        const c = this.peek()
        const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '/': '/', '\\': '\\', "'": "'", '"': '"' }
        if (c === 'u') {
          out += String.fromCharCode(parseInt(this.src.slice(this.i + 1, this.i + 5), 16))
          this.i += 5
          continue
        }
        if (!(c in map)) throw new Fail(`Unknown escape \\${c ?? ''}`, this.i - 1)
        out += map[c]
      } else out += this.peek()
      this.i++
    }
    if (this.peek() !== quote) throw new Fail('This string is never closed', start)
    this.i++
    return out
  }

  int(): number | undefined {
    const match = /^-?\d+/.exec(this.src.slice(this.i))
    if (!match) return undefined
    this.i += match[0].length
    return Number(match[0])
  }

  /** Segments after `$` or `@`, until something that is not `.` `..` or `[`. */
  segments(inFilter: boolean): JsonQuerySegment[] {
    const out: JsonQuerySegment[] = []
    for (;;) {
      if (!inFilter) this.ws()
      if (this.eat('..')) {
        if (this.peek() === '[') out.push({ descendant: true, selectors: this.bracket() })
        else if (this.eat('*')) out.push({ descendant: true, selectors: [{ kind: 'wildcard' }] })
        else out.push({ descendant: true, selectors: [{ kind: 'name', name: this.name() }] })
      } else if (this.eat('.')) {
        if (this.eat('*')) out.push({ descendant: false, selectors: [{ kind: 'wildcard' }] })
        else out.push({ descendant: false, selectors: [{ kind: 'name', name: this.name() }] })
      } else if (this.peek() === '[') {
        out.push({ descendant: false, selectors: this.bracket() })
      } else return out
    }
  }

  bracket(): JsonQuerySelector[] {
    const open = this.i
    this.i++
    const selectors: JsonQuerySelector[] = []
    for (;;) {
      this.ws()
      const c = this.peek()
      if (c === undefined) throw new Fail('This [ is never closed', open)
      if (c === "'" || c === '"') selectors.push({ kind: 'name', name: this.string() })
      else if (this.eat('*')) selectors.push({ kind: 'wildcard' })
      else if (this.eat('?')) {
        this.ws()
        const wrapped = this.peek() === '(' && this.closesFilter()
        if (wrapped) this.i++
        const expr = this.or()
        if (wrapped) this.expect(')')
        selectors.push({ kind: 'filter', expr })
      } else if (c === ':' || c === '-' || /\d/.test(c)) {
        const start = this.int()
        this.ws()
        if (this.peek() === ':') {
          this.i++
          this.ws()
          const end = this.int()
          this.ws()
          let step: number | undefined
          if (this.eat(':')) {
            this.ws()
            step = this.int()
          }
          if (step === 0) throw new Fail('A slice step of 0 selects nothing', this.i - 1)
          selectors.push({ kind: 'slice', start, end, step })
        } else if (start === undefined) throw new Fail(`Unexpected “${c}”`, this.i)
        else selectors.push({ kind: 'index', index: start })
      } else throw new Fail(`Unexpected “${c}” in brackets`, this.i)
      this.ws()
      if (this.eat(']')) return selectors
      this.expect(',', '“,” or “]”')
    }
  }

  /** Whether the ( after ? wraps the whole filter (Goessner style) or only its start. */
  closesFilter(): boolean {
    let depth = 0
    let quote: string | null = null
    for (let j = this.i; j < this.src.length; j++) {
      const c = this.src[j]
      if (quote) {
        if (c === '\\') j++
        else if (c === quote) quote = null
      } else if (c === "'" || c === '"') quote = c
      else if (c === '(') depth++
      else if (c === ')') {
        depth--
        if (depth === 0) {
          let k = j + 1
          while (/\s/.test(this.src[k] ?? '')) k++
          return this.src[k] === ']' || this.src[k] === ','
        }
      }
    }
    return false
  }

  or(): JsonQueryExpr {
    let a = this.and()
    for (;;) {
      this.ws()
      if (!this.eat('||')) return a
      a = { t: 'or', a, b: this.and() }
    }
  }
  and(): JsonQueryExpr {
    let a = this.not()
    for (;;) {
      this.ws()
      if (!this.eat('&&')) return a
      a = { t: 'and', a, b: this.not() }
    }
  }
  not(): JsonQueryExpr {
    this.ws()
    if (this.peek() === '!' && this.peek(1) !== '=') {
      this.i++
      return { t: 'not', e: this.not() }
    }
    return this.cmp()
  }
  cmp(): JsonQueryExpr {
    const a = this.primary()
    this.ws()
    const op = ['==', '!=', '<=', '>=', '=~', '<', '>'].find((o) => this.src.startsWith(o, this.i))
    if (!op) {
      if (this.peek() === '=') throw new Fail('Use == to compare', this.i)
      return a
    }
    this.i += op.length
    this.ws()
    if (op === '=~') {
      if (this.peek() !== '/') throw new Fail('=~ needs a /regex/ on its right', this.i)
      return { t: 'cmp', op, a, b: this.regex() }
    }
    return { t: 'cmp', op, a, b: this.primary() }
  }
  regex(): JsonQueryExpr {
    const start = this.i
    this.i++
    let body = ''
    while (this.i < this.src.length && this.peek() !== '/') {
      if (this.peek() === '\\') body += this.src[this.i++]
      body += this.src[this.i++]
    }
    if (!this.eat('/')) throw new Fail('This /regex/ is never closed', start)
    const flags = /^[imsu]*/.exec(this.src.slice(this.i))![0]
    this.i += flags.length
    try {
      return { t: 'regex', re: new RegExp(body, flags) }
    } catch (error) {
      throw new Fail(error instanceof Error ? error.message : 'Invalid regex', start)
    }
  }
  primary(): JsonQueryExpr {
    this.ws()
    const c = this.peek()
    const start = this.i
    if (c === undefined) throw new Fail('The filter ends early', this.i)
    if (c === '(') {
      this.i++
      const e = this.or()
      this.expect(')')
      return e
    }
    if (c === '@' || c === '$') {
      this.i++
      return { t: 'path', root: c, segments: this.segments(true) }
    }
    if (c === "'" || c === '"') return { t: 'lit', value: this.string() }
    const num = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?/.exec(this.src.slice(this.i))
    if (num) {
      this.i += num[0].length
      return { t: 'lit', value: Number(num[0]) }
    }
    for (const [word, value] of [['true', true], ['false', false], ['null', null]] as const) {
      if (this.src.startsWith(word, this.i) && !NAME_CHAR.test(this.src[this.i + word.length] ?? '')) {
        this.i += word.length
        return { t: 'lit', value }
      }
    }
    const fn = /^(length|count)\s*\(/.exec(this.src.slice(this.i))
    if (fn) {
      this.i += fn[0].length
      const arg = this.or()
      this.expect(')')
      return { t: 'fn', name: fn[1] as 'length' | 'count', arg }
    }
    throw new Fail(`Unexpected “${c}” in the filter`, start)
  }
}

export function parseJsonPath(src: string): { ok: true; segments: JsonQuerySegment[] } | { ok: false; error: JsonQueryError } {
  const parser = new Parser(src)
  try {
    parser.ws()
    if (!parser.eat('$')) throw new Fail('A path starts with $', parser.i)
    const segments = parser.segments(false)
    parser.ws()
    if (parser.i < src.length) throw new Fail(`Unexpected “${src[parser.i]}”`, parser.i)
    return { ok: true, segments }
  } catch (error) {
    if (error instanceof Fail) return { ok: false, error: { message: error.message, at: error.at } }
    throw error
  }
}

/* ------------------------------------------------------------ evaluation */

interface Node {
  value: unknown
  parts: JsonQueryPathPart[]
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const LIMIT = 20_000

function children(node: Node): Node[] {
  if (Array.isArray(node.value)) return node.value.map((value, i) => ({ value, parts: [...node.parts, i] }))
  if (isObject(node.value)) return Object.keys(node.value).map((k) => ({ value: (node.value as Record<string, unknown>)[k], parts: [...node.parts, k] }))
  return []
}

function descendants(node: Node, out: Node[] = []): Node[] {
  out.push(node)
  if (out.length > LIMIT) return out
  for (const child of children(node)) descendants(child, out)
  return out
}

function select(node: Node, selector: JsonQuerySelector, root: unknown): Node[] {
  const v = node.value
  switch (selector.kind) {
    case 'name':
      if (isObject(v) && has(v, selector.name)) return [{ value: v[selector.name], parts: [...node.parts, selector.name] }]
      // Filters read @.tags.length as JavaScript would.
      if (selector.name === 'length' && (Array.isArray(v) || typeof v === 'string')) return [{ value: v.length, parts: [...node.parts, 'length'] }]
      return []
    case 'wildcard':
      return children(node)
    case 'index': {
      if (!Array.isArray(v)) return []
      const i = selector.index < 0 ? v.length + selector.index : selector.index
      return i >= 0 && i < v.length ? [{ value: v[i], parts: [...node.parts, i] }] : []
    }
    case 'slice': {
      if (!Array.isArray(v)) return []
      const len = v.length
      const step = selector.step ?? 1
      const norm = (n: number) => (n < 0 ? Math.max(len + n, step > 0 ? 0 : -1) : Math.min(n, step > 0 ? len : len - 1))
      const start = selector.start === undefined ? (step > 0 ? 0 : len - 1) : norm(selector.start)
      const end = selector.end === undefined ? (step > 0 ? len : -1) : norm(selector.end)
      const out: Node[] = []
      for (let i = start; step > 0 ? i < end : i > end; i += step) out.push({ value: v[i], parts: [...node.parts, i] })
      return out
    }
    case 'filter':
      return children(node).filter((child) => truthy(evaluate(selector.expr, child, root)))
  }
}

function run(segments: JsonQuerySegment[], start: Node[], root: unknown): Node[] {
  let nodes = start
  for (const segment of segments) {
    const next: Node[] = []
    for (const node of nodes) {
      const bases = segment.descendant ? descendants(node) : [node]
      for (const base of bases) for (const selector of segment.selectors) next.push(...select(base, selector, root))
      if (next.length > LIMIT) break
    }
    nodes = next.slice(0, LIMIT)
  }
  return nodes
}

type Val = { nodes: Node[] } | { value: unknown } | { bool: boolean }

function evaluate(expr: JsonQueryExpr, current: Node, root: unknown): Val {
  switch (expr.t) {
    case 'lit':
      return { value: expr.value }
    case 'regex':
      return { value: expr.re }
    case 'path':
      return { nodes: run(expr.segments, [expr.root === '@' ? current : { value: root, parts: [] }], root) }
    case 'not':
      return { bool: !truthy(evaluate(expr.e, current, root)) }
    case 'and':
      return { bool: truthy(evaluate(expr.a, current, root)) && truthy(evaluate(expr.b, current, root)) }
    case 'or':
      return { bool: truthy(evaluate(expr.a, current, root)) || truthy(evaluate(expr.b, current, root)) }
    case 'fn': {
      const arg = evaluate(expr.arg, current, root)
      if (expr.name === 'count') return { value: 'nodes' in arg ? arg.nodes.length : undefined }
      const v = single(arg)
      return { value: typeof v === 'string' || Array.isArray(v) ? v.length : isObject(v) ? Object.keys(v).length : undefined }
    }
    case 'cmp':
      return { bool: compare(expr.op, single(evaluate(expr.a, current, root)), single(evaluate(expr.b, current, root))) }
  }
}

const NOTHING = Symbol('nothing')

/** A comparison operand: the one node's value, or nothing. */
function single(val: Val): unknown {
  if ('nodes' in val) return val.nodes.length === 1 ? val.nodes[0].value : NOTHING
  if ('bool' in val) return val.bool
  return val.value
}

/** A test: a path is true when it selects something; a comparison by its result. */
function truthy(val: Val): boolean {
  if ('nodes' in val) return val.nodes.length > 0
  if ('bool' in val) return val.bool
  return Boolean(val.value)
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equal(x, b[i]))
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a)
    return ka.length === Object.keys(b).length && ka.every((k) => has(b, k) && equal(a[k], b[k]))
  }
  return false
}

function compare(op: string, a: unknown, b: unknown): boolean {
  if (op === '=~') return typeof a === 'string' && b instanceof RegExp && b.test(a)
  if (op === '==') return equal(a, b)
  if (op === '!=') return !equal(a, b)
  const comparable = (typeof a === 'number' && typeof b === 'number') || (typeof a === 'string' && typeof b === 'string')
  if (!comparable) return op === '<=' || op === '>=' ? equal(a, b) : false
  const x = a as number | string
  const y = b as number | string
  return op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y
}

/** The RFC 9535 normalised path. */
export function normalise(parts: JsonQueryPathPart[]): string {
  return `$${parts.map((p) => (typeof p === 'number' ? `[${p}]` : `['${p.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`)).join('')}`
}

export function queryJson(data: unknown, src: string): { ok: true; results: JsonQueryResult[] } | { ok: false; error: JsonQueryError } {
  const parsed = parseJsonPath(src)
  if (!parsed.ok) return parsed
  const nodes = run(parsed.segments, [{ value: data, parts: [] }], data)
  return { ok: true, results: nodes.map((node) => ({ path: normalise(node.parts), parts: node.parts, value: node.value })) }
}
