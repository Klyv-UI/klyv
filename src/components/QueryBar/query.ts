/**
 * The search syntax behind QueryBar, as a tokeniser, a parser and a matcher.
 *
 *   status:open -label:bug "exact phrase" created:>2024-01-01 assignee:@me OR priority:high
 *
 * Terms side by side must all hold. OR binds tighter than that, as in web
 * search, so `a b OR c` means a, and either b or c. A leading `-` negates a
 * term or a parenthesised group. A qualifier is `key:value`, with an optional
 * comparator (`>`, `>=`, `<`, `<=`) for dates and numbers, and quotes for a
 * value with spaces.
 */

export type QueryBarFieldType = 'enum' | 'text' | 'date' | 'number' | 'user'

export interface QueryBarField {
  type: QueryBarFieldType
  /** Values to suggest, and for `enum` the only ones accepted. */
  values?: string[]
  /** One line shown beside the key in completions. */
  description?: string
}

export type QueryBarSchema = Record<string, QueryBarField>

export type QueryBarOperator = '=' | '>' | '>=' | '<' | '<='

export type QueryBarNode =
  | { type: 'and'; children: QueryBarNode[] }
  | { type: 'or'; children: QueryBarNode[] }
  | { type: 'not'; child: QueryBarNode }
  | {
      type: 'term'
      /** Absent for free text. */
      key?: string
      op: QueryBarOperator
      value: string
      quoted: boolean
      start: number
      end: number
    }

export interface QueryBarIssue {
  message: string
  start: number
  end: number
  severity: 'error' | 'warning'
}

/** A piece of the input, for drawing it: what it is and where it sits. */
export interface QueryBarToken {
  kind: 'term' | 'or' | 'open' | 'close' | 'not'
  start: number
  end: number
  negated?: boolean
  key?: string
  /** Where the key and its colon end — the value starts here. */
  keyEnd?: number
  op?: QueryBarOperator
  value?: string
  quoted?: boolean
}

export interface QueryBarParseResult {
  /** null for an empty query, which matches everything. */
  ast: QueryBarNode | null
  issues: QueryBarIssue[]
  tokens: QueryBarToken[]
}

const STOP = /[\s()]/

export function tokenizeQuery(input: string, issues: QueryBarIssue[] = []): QueryBarToken[] {
  const tokens: QueryBarToken[] = []
  let i = 0
  const quoted = (from: number) => {
    const close = input.indexOf('"', from + 1)
    if (close < 0) {
      issues.push({ message: 'This quote is never closed', start: from, end: input.length, severity: 'error' })
      i = input.length
      return input.slice(from + 1)
    }
    i = close + 1
    return input.slice(from + 1, close)
  }
  while (i < input.length) {
    const char = input[i]
    if (/\s/.test(char)) {
      i++
      continue
    }
    const start = i
    if (char === '(' || char === ')') {
      tokens.push({ kind: char === '(' ? 'open' : 'close', start, end: ++i })
      continue
    }
    if (char === '-' && input[i + 1] === '(') {
      tokens.push({ kind: 'not', start, end: ++i })
      continue
    }
    const negated = char === '-' && i + 1 < input.length && !STOP.test(input[i + 1])
    if (negated) i++
    if (input[i] === '"') {
      const value = quoted(i)
      tokens.push({ kind: 'term', start, end: i, negated, value, quoted: true })
      continue
    }
    let word = ''
    while (i < input.length && !STOP.test(input[i]) && input[i] !== ':' && input[i] !== '"') word += input[i++]
    if (input[i] === ':' && word) {
      i++
      const keyEnd = i
      const op = (/^(>=|<=|>|<)/.exec(input.slice(i))?.[0] ?? '=') as QueryBarOperator
      if (op !== '=') i += op.length
      let value = ''
      let isQuoted = false
      if (input[i] === '"') {
        value = quoted(i)
        isQuoted = true
      } else while (i < input.length && !STOP.test(input[i])) value += input[i++]
      tokens.push({ kind: 'term', start, end: i, negated, key: word, keyEnd, op, value, quoted: isQuoted })
      continue
    }
    while (i < input.length && !STOP.test(input[i])) word += input[i++]
    if (word === 'OR' && !negated) tokens.push({ kind: 'or', start, end: i })
    else tokens.push({ kind: 'term', start, end: i, negated, value: word, quoted: false })
  }
  return tokens
}

function check(token: QueryBarToken, schema: QueryBarSchema, issues: QueryBarIssue[]) {
  if (!token.key) return
  const field = schema[token.key]
  const at = { start: token.start, end: token.end }
  if (!field) {
    issues.push({ message: `Unknown filter “${token.key}” — searched as text`, ...at, severity: 'warning' })
    return
  }
  const value = token.value ?? ''
  if (!value) {
    issues.push({ message: `${token.key}: needs a value`, ...at, severity: 'error' })
    return
  }
  const ordered = field.type === 'date' || field.type === 'number'
  if (token.op !== '=' && !ordered) issues.push({ message: `${token.key} cannot be compared with ${token.op}`, ...at, severity: 'error' })
  if (field.type === 'enum' && field.values && !field.values.some((option) => option.toLowerCase() === value.toLowerCase()))
    issues.push({ message: `“${value}” is not a ${token.key} — try ${field.values.join(', ')}`, ...at, severity: 'error' })
  if (field.type === 'date' && Number.isNaN(Date.parse(value)))
    issues.push({ message: `“${value}” is not a date — write it as 2024-01-31`, ...at, severity: 'error' })
  if (field.type === 'number' && !Number.isFinite(Number(value)))
    issues.push({ message: `“${value}” is not a number`, ...at, severity: 'error' })
}

/** Parse a query into a tree, with every problem found and where it is. */
export function parseQuery(input: string, schema: QueryBarSchema = {}): QueryBarParseResult {
  const issues: QueryBarIssue[] = []
  const tokens = tokenizeQuery(input, issues)
  let at = 0

  const term = (token: QueryBarToken): QueryBarNode => {
    check(token, schema, issues)
    const known = token.key !== undefined && schema[token.key] !== undefined
    const node: QueryBarNode = known
      ? { type: 'term', key: token.key, op: token.op ?? '=', value: token.value ?? '', quoted: !!token.quoted, start: token.start, end: token.end }
      : {
          type: 'term',
          op: '=',
          value: token.key !== undefined ? `${token.key}:${token.value ?? ''}` : (token.value ?? ''),
          quoted: !!token.quoted,
          start: token.start,
          end: token.end,
        }
    return token.negated ? { type: 'not', child: node } : node
  }

  const unary = (): QueryBarNode | null => {
    const token = tokens[at]
    if (!token) return null
    if (token.kind === 'term') {
      at++
      return term(token)
    }
    if (token.kind === 'open' || token.kind === 'not') {
      at++
      if (token.kind === 'not') {
        if (tokens[at]?.kind !== 'open') return null
        at++
      }
      const inner = sequence(true)
      if (tokens[at]?.kind === 'close') at++
      else issues.push({ message: 'This bracket is never closed', start: token.start, end: token.end, severity: 'error' })
      if (!inner) return null
      return token.kind === 'not' ? { type: 'not', child: inner } : inner
    }
    return null
  }

  const group = (): QueryBarNode | null => {
    const first = unary()
    const children = first ? [first] : []
    while (tokens[at]?.kind === 'or') {
      const or = tokens[at++]
      const next = unary()
      if (!next || children.length === 0) issues.push({ message: 'OR needs a term on each side', start: or.start, end: or.end, severity: 'error' })
      if (next) children.push(next)
    }
    if (children.length === 0) return null
    return children.length === 1 ? children[0] : { type: 'or', children }
  }

  const sequence = (nested: boolean): QueryBarNode | null => {
    const children: QueryBarNode[] = []
    while (at < tokens.length) {
      const token = tokens[at]
      if (token.kind === 'close') {
        if (nested) break
        issues.push({ message: 'This bracket closes nothing', start: token.start, end: token.end, severity: 'error' })
        at++
        continue
      }
      const node = group()
      if (node) children.push(node)
      else if (tokens[at] === token) at++
    }
    if (children.length === 0) return null
    return children.length === 1 ? children[0] : { type: 'and', children }
  }

  const ast = sequence(false)
  issues.sort((a, b) => a.start - b.start)
  return { ast, issues, tokens }
}

export interface QueryBarMatchOptions {
  schema?: QueryBarSchema
  /** Who `@me` is. */
  me?: string
  /** Fields free text searches. Defaults to every string field of the record. */
  textFields?: string[]
}

const text = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap(text) : typeof value === 'string' || typeof value === 'number' ? [String(value).toLowerCase()] : []

/** Whether a record satisfies a parsed query. An empty query matches everything. */
export function matchesQuery(record: Record<string, unknown>, ast: QueryBarNode | null, options: QueryBarMatchOptions = {}): boolean {
  if (!ast) return true
  const { schema = {}, me, textFields } = options
  switch (ast.type) {
    case 'and':
      return ast.children.every((child) => matchesQuery(record, child, options))
    case 'or':
      return ast.children.some((child) => matchesQuery(record, child, options))
    case 'not':
      return !matchesQuery(record, ast.child, options)
  }
  const needle = (ast.value === '@me' && me ? me : ast.value).toLowerCase()
  if (!ast.key) {
    const haystack = (textFields ?? Object.keys(record)).flatMap((field) => text(record[field]))
    return haystack.some((value) => value.includes(needle))
  }
  const field = schema[ast.key]
  const values = Array.isArray(record[ast.key]) ? (record[ast.key] as unknown[]) : [record[ast.key]]
  return values.some((raw) => {
    if (raw === undefined || raw === null) return false
    if (field?.type === 'date' || field?.type === 'number') {
      const left = field.type === 'date' ? Date.parse(String(raw)) : Number(raw)
      const right = field.type === 'date' ? Date.parse(ast.value) : Number(ast.value)
      if (Number.isNaN(left) || Number.isNaN(right)) return false
      if (ast.op === '>') return left > right
      if (ast.op === '>=') return left >= right
      if (ast.op === '<') return left < right
      if (ast.op === '<=') return left <= right
      return field.type === 'date' ? String(raw).slice(0, ast.value.length) === ast.value : left === right
    }
    const value = String(raw).toLowerCase()
    return field?.type === 'text' ? value.includes(needle) : value === needle
  })
}
