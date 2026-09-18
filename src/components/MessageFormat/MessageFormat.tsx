import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type MessageFormatValue = string | number | boolean | Date | null | undefined
export type MessageFormatValues = Record<string, MessageFormatValue>

/** One piece of a parsed message. `start` and `end` are offsets into the pattern. */
export type MessageFormatNode =
  | { type: 'text'; value: string }
  | { type: 'pound'; start: number }
  | { type: 'arg'; name: string; start: number; end: number }
  | { type: 'number' | 'date' | 'time'; name: string; style: string; start: number; end: number }
  | {
      type: 'plural' | 'selectordinal'
      name: string
      offset: number
      options: Record<string, MessageFormatNode[]>
      start: number
      end: number
    }
  | { type: 'select'; name: string; options: Record<string, MessageFormatNode[]>; start: number; end: number }

/** A syntax error, with the offset in the pattern where it was found. */
export class MessageFormatError extends Error {
  readonly offset: number
  constructor(message: string, offset: number) {
    super(message)
    this.name = 'MessageFormatError'
    this.offset = offset
  }
}

const TYPES = new Set(['number', 'date', 'time', 'plural', 'selectordinal', 'select'])
const PLURAL_KEYS = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])

/** Parse an ICU MessageFormat pattern into a tree. Throws MessageFormatError with the offset of the fault. */
export function parseMessage(pattern: string): MessageFormatNode[] {
  let i = 0
  const fail = (message: string, at = i): never => {
    throw new MessageFormatError(message, at)
  }
  const space = () => {
    while (i < pattern.length && /\s/.test(pattern[i])) i++
  }
  const word = () => {
    const from = i
    while (i < pattern.length && !/[\s{},#:=]/.test(pattern[i])) i++
    return pattern.slice(from, i)
  }

  // A run of text. ICU quoting: '' is an apostrophe, and an apostrophe before
  // a syntax character starts a literal that runs to the next lone apostrophe.
  const message = (depth: number, inPlural: boolean): MessageFormatNode[] => {
    const nodes: MessageFormatNode[] = []
    let text = ''
    const flush = () => {
      if (text) nodes.push({ type: 'text', value: text })
      text = ''
    }
    while (i < pattern.length) {
      const char = pattern[i]
      if (char === "'") {
        const next = pattern[i + 1]
        if (next === "'") {
          text += "'"
          i += 2
        } else if (next === '{' || next === '}' || (inPlural && next === '#')) {
          i++
          while (i < pattern.length) {
            if (pattern[i] === "'" && pattern[i + 1] === "'") {
              text += "'"
              i += 2
            } else if (pattern[i] === "'") {
              i++
              break
            } else text += pattern[i++]
          }
        } else {
          text += char
          i++
        }
      } else if (char === '{') {
        flush()
        nodes.push(argument(inPlural))
      } else if (char === '}') {
        if (depth === 0) fail('Unmatched closing brace')
        break
      } else if (char === '#' && inPlural) {
        flush()
        nodes.push({ type: 'pound', start: i })
        i++
      } else {
        text += char
        i++
      }
    }
    flush()
    return nodes
  }

  const options = (kind: string, start: number, inPlural: boolean) => {
    const found: Record<string, MessageFormatNode[]> = {}
    for (;;) {
      space()
      if (i >= pattern.length) fail(`Unclosed ${kind} argument`, start)
      if (pattern[i] === '}') break
      const at = i
      let key: string
      if (pattern[i] === '=') {
        i++
        key = `=${word()}`
      } else key = word()
      if (!key) fail(`Expected a ${kind} option`)
      if (key.startsWith('=') && !Number.isFinite(Number(key.slice(1)))) fail(`“${key}” is not an exact number`, at)
      if (kind !== 'select' && !key.startsWith('=') && !PLURAL_KEYS.has(key))
        fail(`“${key}” is not a plural category (zero, one, two, few, many, other)`, at)
      if (found[key]) fail(`Option “${key}” appears twice`, at)
      space()
      if (pattern[i] !== '{') fail(`Expected { after “${key}”`)
      i++
      found[key] = message(1, kind === 'select' ? inPlural : true)
      if (pattern[i] !== '}') fail(`Unclosed option “${key}”`, at)
      i++
    }
    if (!found.other) fail(`A ${kind} argument needs an “other” option`, start)
    return found
  }

  const argument = (inPlural: boolean): MessageFormatNode => {
    const start = i
    i++
    space()
    const name = word()
    if (!name) fail('Expected an argument name')
    space()
    if (pattern[i] === '}') {
      i++
      return { type: 'arg', name, start, end: i }
    }
    if (pattern[i] !== ',') fail(`Expected , or } after “${name}”`)
    i++
    space()
    const typeAt = i
    const type = word()
    if (!TYPES.has(type)) fail(`Unknown argument type “${type}”`, typeAt)
    space()
    if (type === 'number' || type === 'date' || type === 'time') {
      let style = ''
      if (pattern[i] === ',') {
        i++
        const from = i
        while (i < pattern.length && pattern[i] !== '}') i++
        style = pattern.slice(from, i).trim()
      }
      if (pattern[i] !== '}') fail(`Unclosed ${type} argument`, start)
      i++
      return { type, name, style, start, end: i } as MessageFormatNode
    }
    if (pattern[i] !== ',') fail(`Expected , after ${type}`)
    i++
    space()
    let offset = 0
    if (type !== 'select' && pattern.startsWith('offset:', i)) {
      i += 7
      space()
      const at = i
      offset = Number(word())
      if (!Number.isFinite(offset)) fail('offset: needs a number', at)
    }
    const found = options(type, start, inPlural)
    i++
    if (type === 'select') return { type, name, options: found, start, end: i }
    return { type: type as 'plural' | 'selectordinal', name, offset, options: found, start, end: i }
  }

  return message(0, false)
}

const cache = new Map<string, MessageFormatNode[]>()
function parsed(pattern: string) {
  let tree = cache.get(pattern)
  if (!tree) {
    tree = parseMessage(pattern)
    if (cache.size > 200) cache.clear()
    cache.set(pattern, tree)
  }
  return tree
}

function numberOptions(style: string): Intl.NumberFormatOptions {
  if (style === 'integer') return { maximumFractionDigits: 0 }
  if (style === 'percent') return { style: 'percent' }
  const currency = /^currency\/([A-Za-z]{3})$/.exec(style)
  if (currency) return { style: 'currency', currency: currency[1].toUpperCase() }
  return {}
}

function dateOptions(type: 'date' | 'time', style: string): Intl.DateTimeFormatOptions {
  const size = (['short', 'medium', 'long', 'full'].includes(style) ? style : 'medium') as 'short' | 'medium' | 'long' | 'full'
  return type === 'date' ? { dateStyle: size } : { timeStyle: size }
}

function render(nodes: MessageFormatNode[], values: MessageFormatValues, locale: string, pound: number | null): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'text') out += node.value
    else if (node.type === 'pound') out += pound === null ? '#' : new Intl.NumberFormat(locale).format(pound)
    else {
      const value = values[node.name]
      if (node.type === 'arg') {
        if (value === undefined || value === null) out += `{${node.name}}`
        else if (typeof value === 'number') out += new Intl.NumberFormat(locale).format(value)
        else if (value instanceof Date) out += new Intl.DateTimeFormat(locale).format(value)
        else out += String(value)
      } else if (node.type === 'number') {
        out += new Intl.NumberFormat(locale, numberOptions(node.style)).format(Number(value))
      } else if (node.type === 'date' || node.type === 'time') {
        const date = value instanceof Date ? value : new Date(value as string | number)
        out += Number.isNaN(date.getTime()) ? `{${node.name}}` : new Intl.DateTimeFormat(locale, dateOptions(node.type, node.style)).format(date)
      } else if (node.type === 'select') {
        out += render(node.options[String(value)] ?? node.options.other, values, locale, pound)
      } else if (node.type === 'plural' || node.type === 'selectordinal') {
        const count = Number(value)
        const exact = node.options[`=${count}`]
        const category = new Intl.PluralRules(locale, { type: node.type === 'plural' ? 'cardinal' : 'ordinal' }).select(count - node.offset)
        out += render(exact ?? node.options[category] ?? node.options.other, values, locale, count - node.offset)
      }
    }
  }
  return out
}

/**
 * Format an ICU message. Plural categories come from Intl.PluralRules for the
 * locale, so Arabic gets its six forms and Japanese its one without a table
 * here. Throws MessageFormatError on a malformed pattern.
 */
export function formatMessage(pattern: string, values: MessageFormatValues = {}, locale = 'en'): string {
  return render(parsed(pattern), values, locale, null)
}

/** The plural categories a locale distinguishes — what a translator has to write. */
export function pluralCategories(locale: string, type: 'cardinal' | 'ordinal' = 'cardinal'): string[] {
  const order = ['zero', 'one', 'two', 'few', 'many', 'other']
  const found = new Intl.PluralRules(locale, { type }).resolvedOptions().pluralCategories as string[]
  return order.filter((category) => found.includes(category))
}

export interface MessageFormatProps {
  /** The ICU pattern — "{count, plural, one {# file} other {# files}}". */
  message: string
  /** Values for the arguments the pattern names. */
  values?: MessageFormatValues
  /** BCP 47 locale for plural rules, numbers and dates. */
  locale?: string
  /** Rendered instead when the pattern does not parse. Defaults to the raw pattern. */
  fallback?: ReactNode
  /** Called with the parse error when the pattern does not parse. */
  onError?: (error: MessageFormatError) => void
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A translated sentence with its counts, genders and dates in the right form.
 *
 * String concatenation — `${n} file${n === 1 ? '' : 's'}` — is English with a
 * patch on it: Polish needs three forms, Arabic six, and "1st/2nd/3rd" needs
 * its own rules. This parses the ICU syntax translators already use and asks
 * the platform's plural rules which form a number takes, so no language is
 * special-cased in code. A broken pattern renders as written, never as a crash.
 */
export function MessageFormat({ message, values, locale = 'en', fallback, onError, className }: MessageFormatProps) {
  let text: ReactNode
  try {
    text = formatMessage(message, values, locale)
  } catch (error) {
    if (!(error instanceof MessageFormatError)) throw error
    onError?.(error)
    text = fallback ?? message
  }
  return <span className={cn(className)}>{text}</span>
}
