'use client'

import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'

export type FormulaEditorValue = number | string | boolean

export interface FormulaEditorFunction {
  /** Upper-case name, as typed: `SUM`. */
  name: string
  /** Argument names in order. A trailing `…` marks a repeating last argument: `['number1', 'number2…']`. */
  args: string[]
  /** One line on what it returns. */
  description?: string
  /** Computes the result. Ranges arrive as arrays. Throw a string such as '#VALUE!' to return an error. */
  evaluate?: (args: (FormulaEditorValue | FormulaEditorValue[])[]) => FormulaEditorValue
}

export interface FormulaEditorProps {
  /** Controlled formula, including the leading `=`. */
  value?: string
  /** Starting formula when uncontrolled. */
  defaultValue?: string
  /** Called with the formula after every edit. */
  onValueChange?: (value: string) => void
  /** Functions offered and understood. Defaults to SUM, AVERAGE, MIN, MAX, COUNT, ROUND, ABS, IF and CONCAT. */
  functions?: FormulaEditorFunction[]
  /** Cell values by reference (`A1`). When given, the result is computed and shown. */
  cells?: Record<string, FormulaEditorValue>
  /** Accessible name. Pair with a Field for a visible one. */
  label: string
  placeholder?: string
  /** Marks the field invalid from outside. Parse errors do this by themselves once the field is left. */
  invalid?: boolean
  disabled?: boolean
  /** Overrides the generated id. Field supplies one. */
  id?: string
  /** Extra descriptions, such as a Field hint. */
  'aria-describedby'?: string
  /** Merged last, so it wins. */
  className?: string
}

/* ------------------------------------------------------------- tokenizer */

type TokenType = 'number' | 'string' | 'bool' | 'ref' | 'name' | 'op' | '(' | ')' | ',' | ':' | 'bad'
interface Token { type: TokenType; text: string; start: number; end: number; open?: boolean }

const REF = /^\$?[A-Za-z]{1,3}\$?\d+$/
const RULES: [TokenType, RegExp][] = [
  ['number', /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/],
  ['name', /^[A-Za-z_][A-Za-z0-9_.]*|^\$[A-Za-z]{1,3}\$?\d+/],
  ['op', /^(<>|<=|>=|[-+*/^&=<>])/],
  ['(', /^\(/],
  [')', /^\)/],
  [',', /^[,;]/],
  [':', /^:/],
]

/** Splits a formula (without its `=`) into tokens. Never throws: unknown characters become `bad` tokens. */
function tokenize(source: string, offset = 1): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < source.length) {
    if (/\s/.test(source[i])) {
      i++
      continue
    }
    const start = i + offset
    if (source[i] === '"') {
      let j = i + 1
      let text = ''
      while (j < source.length && !(source[j] === '"' && source[j + 1] !== '"')) {
        text += source[j]
        j += source[j] === '"' ? 2 : 1
      }
      tokens.push({ type: 'string', text, start, end: j + 1 + offset, open: j >= source.length })
      i = j + 1
      continue
    }
    const rest = source.slice(i)
    const rule = RULES.find(([, pattern]) => pattern.test(rest))
    let type: TokenType = rule ? rule[0] : 'bad'
    const text = rule ? rule[1].exec(rest)![0] : source[i]
    if (type === 'name' && source[i + text.length] !== '(') {
      if (REF.test(text)) type = 'ref'
      else if (/^(true|false)$/i.test(text)) type = 'bool'
    }
    tokens.push({ type, text, start, end: start + text.length })
    i += text.length
  }
  return tokens
}

/* ---------------------------------------------------------------- parser */

type Node =
  | { kind: 'value'; value: FormulaEditorValue }
  | { kind: 'ref'; ref: string }
  | { kind: 'range'; from: string; to: string }
  | { kind: 'call'; name: string; args: Node[] }
  | { kind: 'unary'; op: string; arg: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }

export class FormulaEditorParseError extends Error {
  /** 1-based character in the formula, counting the `=`. */
  position: number
  constructor(message: string, position: number) {
    super(message)
    this.position = position
  }
}

const LEVELS = [['=', '<>', '<', '>', '<=', '>='], ['&'], ['+', '-'], ['*', '/'], ['^']]

/** Recursive descent, one function per precedence level, lowest first. Positions count the `=` as character 1. */
function parse(formula: string): Node {
  if (!formula.startsWith('=')) throw new FormulaEditorParseError('A formula starts with =', 1)
  const tokens = tokenize(formula.slice(1))
  let at = 0
  const peek = () => tokens[at]
  const where = () => peek()?.start ?? formula.length + 1
  const describe = (token?: Token) => (token ? `“${token.text}”` : 'the end')
  const expect = (type: TokenType, what: string) => {
    if (peek()?.type !== type) throw new FormulaEditorParseError(`Expected ${what} but found ${describe(peek())}`, where())
    return tokens[at++]
  }

  const level = (depth: number): Node => {
    if (depth === LEVELS.length) return unary()
    let left = level(depth + 1)
    while (peek()?.type === 'op' && LEVELS[depth].includes(peek().text)) {
      const op = tokens[at++].text
      left = { kind: 'binary', op, left, right: level(depth + 1) }
    }
    return left
  }

  const unary = (): Node => {
    if (peek()?.type === 'op' && (peek().text === '-' || peek().text === '+')) return { kind: 'unary', op: tokens[at++].text, arg: unary() }
    return primary()
  }

  const primary = (): Node => {
    const token = peek()
    if (!token) throw new FormulaEditorParseError('The formula ends too early', where())
    at++
    if (token.type === 'number') return { kind: 'value', value: Number(token.text) }
    if (token.type === 'string') {
      if (token.open) throw new FormulaEditorParseError('Close the text with a quotation mark', token.start)
      return { kind: 'value', value: token.text }
    }
    if (token.type === 'bool') return { kind: 'value', value: token.text.toUpperCase() === 'TRUE' }
    if (token.type === 'ref') {
      if (peek()?.type !== ':') return { kind: 'ref', ref: token.text }
      at++
      const end = expect('ref', 'a cell such as B3')
      return { kind: 'range', from: token.text, to: end.text }
    }
    if (token.type === 'name') {
      if (peek()?.type !== '(') throw new FormulaEditorParseError(`“${token.text}” is not a cell or a function`, token.start)
      at++
      const args: Node[] = []
      if (peek()?.type !== ')') {
        do args.push(level(0))
        while (peek()?.type === ',' && ++at)
      }
      expect(')', 'a closing bracket')
      return { kind: 'call', name: token.text.toUpperCase(), args }
    }
    if (token.type === '(') {
      const inner = level(0)
      expect(')', 'a closing bracket')
      return inner
    }
    throw new FormulaEditorParseError(`Unexpected ${describe(token)}`, token.start)
  }

  if (tokens.length === 0) throw new FormulaEditorParseError('Type a formula after =', 2)
  const tree = level(0)
  if (at < tokens.length) throw new FormulaEditorParseError(`Unexpected ${describe(peek())}`, where())
  return tree
}

/* ------------------------------------------------------------- evaluator */

const column = (letters: string) => [...letters.toUpperCase()].reduce((sum, c) => sum * 26 + c.charCodeAt(0) - 64, 0)
const letters = (n: number): string => (n <= 0 ? '' : letters(Math.floor((n - 1) / 26)) + String.fromCharCode(65 + ((n - 1) % 26)))
const split = (ref: string) => {
  const [, col, row] = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(ref)!
  return { col: column(col), row: Number(row) }
}
const num = (v: FormulaEditorValue): number => {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v.trim() === '') return 0
  const n = Number(v)
  if (Number.isNaN(n)) throw '#VALUE!'
  return n
}
const flat = (args: (FormulaEditorValue | FormulaEditorValue[])[]) => args.flat()
const nums = (args: (FormulaEditorValue | FormulaEditorValue[])[]) => flat(args).filter((v) => typeof v === 'number') as number[]

const DEFAULT_FUNCTIONS: FormulaEditorFunction[] = [
  { name: 'SUM', args: ['number1', 'number2…'], description: 'Adds the numbers.', evaluate: (a) => nums(a).reduce((s, n) => s + n, 0) },
  { name: 'AVERAGE', args: ['number1', 'number2…'], description: 'The mean of the numbers.', evaluate: (a) => { const n = nums(a); if (!n.length) throw '#DIV/0!'; return n.reduce((s, x) => s + x, 0) / n.length } },
  { name: 'MIN', args: ['number1', 'number2…'], description: 'The smallest number.', evaluate: (a) => Math.min(...nums(a)) },
  { name: 'MAX', args: ['number1', 'number2…'], description: 'The largest number.', evaluate: (a) => Math.max(...nums(a)) },
  { name: 'COUNT', args: ['value1', 'value2…'], description: 'How many of the values are numbers.', evaluate: (a) => nums(a).length },
  { name: 'ROUND', args: ['number', 'digits'], description: 'Rounds to a number of decimal places.', evaluate: ([n, d = 0]) => { const f = 10 ** num(d as FormulaEditorValue); return Math.round(num(n as FormulaEditorValue) * f) / f } },
  { name: 'ABS', args: ['number'], description: 'The number without its sign.', evaluate: ([n]) => Math.abs(num(n as FormulaEditorValue)) },
  { name: 'IF', args: ['condition', 'if_true', 'if_false'], description: 'Chooses a value by a condition.', evaluate: ([c, t, f = false]) => (num(c as FormulaEditorValue) ? t : f) as FormulaEditorValue },
  { name: 'CONCAT', args: ['text1', 'text2…'], description: 'Joins text together.', evaluate: (a) => flat(a).join('') },
]

function evaluate(node: Node, cells: Record<string, FormulaEditorValue>, functions: FormulaEditorFunction[]): FormulaEditorValue | FormulaEditorValue[] {
  const scalar = (n: Node) => {
    const v = evaluate(n, cells, functions)
    if (Array.isArray(v)) throw '#VALUE!'
    return v
  }
  const cell = (ref: string) => cells[ref.replace(/\$/g, '').toUpperCase()]
  switch (node.kind) {
    case 'value':
      return node.value
    case 'ref':
      return cell(node.ref) ?? 0
    case 'range': {
      const a = split(node.from)
      const b = split(node.to)
      const out: FormulaEditorValue[] = []
      for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++)
        for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) {
          const v = cell(`${letters(c)}${r}`)
          if (v !== undefined) out.push(v)
        }
      return out
    }
    case 'call': {
      const fn = functions.find((f) => f.name === node.name)
      if (!fn?.evaluate) throw '#NAME?'
      return fn.evaluate(node.args.map((arg) => evaluate(arg, cells, functions)))
    }
    case 'unary':
      return node.op === '-' ? -num(scalar(node.arg)) : num(scalar(node.arg))
    case 'binary': {
      const l = scalar(node.left)
      const r = scalar(node.right)
      if (node.op === '&') return `${l}${r}`
      if (['=', '<>', '<', '>', '<=', '>='].includes(node.op)) {
        const text = typeof l === 'string' || typeof r === 'string'
        const d = text ? String(l).toLowerCase().localeCompare(String(r).toLowerCase()) : num(l) - num(r)
        return { '=': d === 0, '<>': d !== 0, '<': d < 0, '>': d > 0, '<=': d <= 0, '>=': d >= 0 }[node.op]!
      }
      const [x, y] = [num(l), num(r)]
      if (node.op === '/' && y === 0) throw '#DIV/0!'
      return { '+': x + y, '-': x - y, '*': x * y, '/': x / y, '^': x ** y }[node.op]!
    }
  }
}

/** The function call the caret is inside, and which argument it is on. */
function callAt(formula: string, caret: number) {
  const stack: ({ name: string; arg: number } | null)[] = []
  const tokens = tokenize(formula.slice(1, caret))
  tokens.forEach((token, index) => {
    if (token.type === '(') stack.push(tokens[index - 1]?.type === 'name' ? { name: tokens[index - 1].text.toUpperCase(), arg: 0 } : null)
    else if (token.type === ')') stack.pop()
    else if (token.type === ',' && stack.length && stack[stack.length - 1]) stack[stack.length - 1]!.arg++
  })
  return [...stack].reverse().find(Boolean) ?? null
}

/**
 * The formula bar of a spreadsheet, for any product that lets people compute
 * a column or a price from other values. It tokenises and parses as you type —
 * numbers, text, cell references and ranges, operators with the usual
 * precedence, function calls — so a mistake is reported with the character
 * where it starts, not as a failed save.
 *
 * Function names complete from the list you give, and inside a call the hint
 * line shows the signature with the current argument in bold, which is the
 * one thing people forget halfway through typing. Given cell values, it also
 * evaluates the formula and shows the result.
 */
export function FormulaEditor({
  value,
  defaultValue = '=',
  onValueChange,
  functions = DEFAULT_FUNCTIONS,
  cells,
  label,
  placeholder = '=SUM(A1:A4)',
  invalid = false,
  disabled = false,
  id,
  'aria-describedby': describedBy,
  className,
}: FormulaEditorProps) {
  const uid = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const formula = value ?? uncontrolled
  const [caret, setCaret] = useState(formula.length)
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [focused, setFocused] = useState(false)
  const [left, setLeft] = useState(false)

  const change = (next: string, nextCaret = next.length) => {
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
    setCaret(nextCaret)
    setDismissed(false)
    setActive(0)
  }

  const before = formula.slice(0, caret)
  const inString = (before.match(/"/g)?.length ?? 0) % 2 === 1
  const word = inString ? '' : (/[A-Za-z_][A-Za-z0-9_.]*$/.exec(before)?.[0] ?? '')
  const matches = word && !REF.test(word) && formula[caret] !== '(' ? functions.filter((f) => f.name.startsWith(word.toUpperCase()) && f.name !== word.toUpperCase()) : []
  const open = focused && !dismissed && matches.length > 0
  const current = Math.min(active, matches.length - 1)

  let error: FormulaEditorParseError | null = null
  let tree: Node | null = null
  if (formula.trim() !== '' && formula.trim() !== '=') {
    try {
      tree = parse(formula)
    } catch (caught) {
      error = caught instanceof FormulaEditorParseError ? caught : new FormulaEditorParseError(String(caught), 1)
    }
  }
  let result: string | null = null
  if (tree && cells) {
    try {
      const v = evaluate(tree, cells, functions)
      result = Array.isArray(v) ? '#VALUE!' : typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 6 }) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : `“${v}”`
    } catch (code) {
      result = typeof code === 'string' ? code : '#ERROR!'
    }
  }

  const call = callAt(formula, caret)
  const signature = call ? functions.find((f) => f.name === call.name) : undefined

  const complete = (fn: FormulaEditorFunction) => {
    const start = caret - word.length
    const next = `${formula.slice(0, start)}${fn.name}(${formula.slice(caret)}`
    const at = start + fn.name.length + 1
    change(next, at)
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(at, at))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return
    const move = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    if (move) {
      event.preventDefault()
      setActive((current + move + matches.length) % matches.length)
    } else if (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey)) {
      event.preventDefault()
      complete(matches[current])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setDismissed(true)
    }
  }

  const showError = Boolean(error) && (left || !focused)
  const listId = `${uid}-list`
  return (
    <div className={cn('relative flex w-full flex-col gap-1.5', disabled && 'opacity-40', className)}>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-serif text-[14px] font-bold italic text-ink-faint">
          fx
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${uid}-opt-${current}` : undefined}
          aria-invalid={invalid || showError || undefined}
          aria-describedby={[describedBy, `${uid}-hint`, `${uid}-status`].filter(Boolean).join(' ')}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          value={formula}
          onChange={(event) => change(event.target.value, event.target.selectionStart ?? event.target.value.length)}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            setLeft(true)
          }}
          className={cn(
            'h-10 w-full rounded-full border bg-surface pl-10 pr-4 font-mono text-[13px] font-medium text-ink placeholder:text-ink-faint focus:border-line-strong disabled:cursor-not-allowed',
            invalid || showError ? 'border-danger focus:border-danger' : 'border-line',
          )}
        />
        <div
          id={listId}
          role="listbox"
          aria-label={`${label} functions`}
          hidden={!open}
          className="absolute inset-x-0 top-full z-10 mt-1.5 max-h-[220px] overflow-y-auto rounded-[var(--radius-tile)] border border-line bg-surface p-1 shadow-[var(--shadow-float)]"
        >
          {open &&
            matches.map((fn, index) => (
              <div
                key={fn.name}
                id={`${uid}-opt-${index}`}
                role="option"
                aria-selected={index === current}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => complete(fn)}
                onMouseMove={() => setActive(index)}
                className={cn('flex cursor-pointer items-baseline gap-2 rounded-[10px] px-2.5 py-1.5', index === current ? 'bg-surface-muted' : '')}
              >
                <span className="font-mono text-[12px] font-bold text-ink">{fn.name}</span>
                {fn.description && <span className="truncate text-[12px] font-medium text-ink-faint">{fn.description}</span>}
              </div>
            ))}
        </div>
      </div>
      <p id={`${uid}-hint`} className="min-h-[18px] px-1 font-mono text-[12px] font-medium text-ink-soft">
        {signature && (
          <>
            {signature.name}(
            {signature.args.map((arg, index) => {
              const repeating = arg.endsWith('…') && call!.arg >= index
              const on = call!.arg === index || (repeating && index === signature.args.length - 1)
              return (
                <span key={arg}>
                  {index > 0 && ', '}
                  <span className={on ? 'font-extrabold text-ink underline decoration-accent-strong decoration-2 underline-offset-2' : undefined}>{arg}</span>
                </span>
              )
            })}
            ){signature.description && <span className="ml-2 font-sans text-ink-faint">{signature.description}</span>}
          </>
        )}
      </p>
      <p id={`${uid}-status`} className={cn('px-1 text-[12px] font-medium', showError ? 'text-danger' : 'text-ink-faint')}>
        {error && showError
          ? `${error.message} (character ${error.position}).`
          : error
            ? 'Keep typing…'
            : result !== null
              ? `Result: ${result}`
              : ''}
      </p>
      <span role="status" className="sr-only">
        {signature && focused ? `${signature.name}, argument ${call!.arg + 1}: ${signature.args[Math.min(call!.arg, signature.args.length - 1)]}` : ''}
        {showError && error ? ` ${error.message}.` : ''}
      </span>
      {error && showError && (
        <pre aria-hidden="true" className="overflow-x-auto px-1 font-mono text-[12px] leading-tight text-ink-soft">
          {formula}
          {'\n'}
          <span className="text-danger">{`${' '.repeat(Math.max(0, error.position - 1))}^`}</span>
        </pre>
      )}
    </div>
  )
}
