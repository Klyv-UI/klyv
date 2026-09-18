'use client'

import { createElement, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type MathFormulaRender = 'auto' | 'mathml' | 'text'

export interface MathFormulaProps {
  /** The formula, in the TeX subset described on the page: fractions, roots, scripts, Greek, big operators, matrices, \text. */
  tex: string
  /** Set on its own line, centred and full size. Off, it sits in a line of text. */
  display?: boolean
  /**
   * `auto` draws MathML where the browser can and falls back to a linear text
   * form where it cannot. `mathml` and `text` force one or the other.
   */
  render?: MathFormulaRender
  /** Called with the message when the formula cannot be parsed. */
  onError?: (message: string) => void
  /** Merged last, so it wins. */
  className?: string
}

/** A MathML element, plus the same thing written out as plain text for the fallback and `alttext`. */
interface MathNode {
  tag: string
  attrs?: Record<string, string | CSSProperties>
  children?: MathNode[]
  text?: string
  plain: string
  /** A big operator whose limits go above and below: ∑, ∏, lim. */
  limits?: 'under' | 'side'
}

class MathFormulaError extends Error {
  constructor(
    message: string,
    public at: number,
  ) {
    super(message)
  }
}

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ', sigma: 'σ', tau: 'τ',
  upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
  Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
}
const IDENTIFIERS: Record<string, string> = { infty: '∞', partial: '∂', nabla: '∇', emptyset: '∅', hbar: 'ℏ', ell: 'ℓ' }
const OPERATORS: Record<string, string> = {
  pm: '±', mp: '∓', times: '×', div: '÷', cdot: '⋅', ast: '∗', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠',
  approx: '≈', equiv: '≡', sim: '∼', propto: '∝', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒',
  Leftarrow: '⇐', Leftrightarrow: '⇔', mapsto: '↦', in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', supset: '⊃',
  cup: '∪', cap: '∩', forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨', circ: '∘', ldots: '…', cdots: '⋯',
  dots: '…', vdots: '⋮', ddots: '⋱', langle: '⟨', rangle: '⟩', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉',
  mid: '∣', parallel: '∥', perp: '⊥', angle: '∠', prime: '′', '{': '{', '}': '}', '|': '‖', '%': '%', '$': '$', '#': '#', '&': '&', _: '_',
}
const BIG: Record<string, [string, 'under' | 'side']> = {
  sum: ['∑', 'under'], prod: ['∏', 'under'], coprod: ['∐', 'under'], bigcup: ['⋃', 'under'], bigcap: ['⋂', 'under'],
  int: ['∫', 'side'], iint: ['∬', 'side'], iiint: ['∭', 'side'], oint: ['∮', 'side'],
}
const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'lg', 'exp', 'det', 'dim', 'ker', 'deg', 'gcd', 'arg', 'Pr'])
const LIMIT_FUNCTIONS = new Set(['lim', 'max', 'min', 'sup', 'inf', 'limsup', 'liminf'])
const SPACES: Record<string, string> = { ',': '0.1667em', ':': '0.2222em', '>': '0.2222em', ';': '0.2778em', ' ': '0.25em', quad: '1em', qquad: '2em', '!': '0em' }
const ACCENTS: Record<string, string> = { hat: '^', bar: '‾', overline: '‾', vec: '→', dot: '˙', ddot: '¨', tilde: '~' }
const ENVIRONMENTS: Record<string, [string, string]> = {
  matrix: ['', ''], pmatrix: ['(', ')'], bmatrix: ['[', ']'], Bmatrix: ['{', '}'], vmatrix: ['|', '|'], Vmatrix: ['‖', '‖'], cases: ['{', ''], aligned: ['', ''],
}
const DOUBLE_STRUCK: Record<string, string> = { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' }

const leaf = (tag: string, text: string, attrs?: MathNode['attrs'], plain = text): MathNode => ({ tag, text, attrs, plain })
const RELATION = /^[=+−±∓×÷<>≤≥≠≈≡∼∝→←⇒⇐⇔↦∈∉⊂⊆⊃∪∩∧∨⋅]$/
/** A function name or big operator, which reads as a word and wants a space before its argument. */
const named = (node?: MathNode) => !!node && (!!node.limits || ((node.tag === 'mi' || node.tag === 'mo') && node.plain.length > 1))
const isRelation = (node?: MathNode) => !!node && node.tag === 'mo' && RELATION.test(node.plain)

/**
 * Plain text for a run of siblings. Binary operators get spaces round them —
 * but a leading minus is a sign, not a subtraction — function names get a
 * space before their argument, and adjacent words are kept apart.
 */
function joinPlain(children: MathNode[]) {
  let out = ''
  children.forEach((node, index) => {
    const previous = children[index - 1]
    let piece = node.plain
    if (isRelation(node)) piece = index === 0 || isRelation(previous) ? piece : ` ${piece} `
    else if (node.tag === 'mo' && piece === ',') piece = ', '
    else if (previous && (named(previous) || (previous.children && named(previous.children[0])))) piece = ` ${piece}`
    else if (previous && /[\p{L})]$/u.test(out) && /^\p{L}/u.test(piece) && (piece.length > 1 || previous.plain.length > 1)) piece = ` ${piece}`
    out += piece
  })
  return out.replace(/\s+/g, ' ').trim()
}
const row = (children: MathNode[]): MathNode => (children.length === 1 ? children[0] : { tag: 'mrow', children, plain: joinPlain(children) })

/** Parenthesise a plain-text piece unless it is one symbol or already one bracketed group. */
function wrap(plain: string) {
  if (/^(\p{L}|\d+(\.\d+)?|[∞′∑∏∫])$/u.test(plain)) return plain
  if (/^[([]/.test(plain)) {
    let depth = 0
    for (let index = 0; index < plain.length; index += 1) {
      depth += '(['.includes(plain[index]) ? 1 : ')]'.includes(plain[index]) ? -1 : 0
      if (depth === 0) return index === plain.length - 1 ? plain : `(${plain})`
    }
  }
  return `(${plain})`
}

/** Recursive descent over the source string. Throws MathFormulaError with the position of the problem. */
function parse(source: string): MathNode {
  let at = 0
  const fail = (message: string): never => {
    throw new MathFormulaError(message, at)
  }
  const skip = () => {
    while (at < source.length && /\s/.test(source[at])) at += 1
  }
  const peekCommand = () => {
    const match = /^\\([a-zA-Z]+|.)/.exec(source.slice(at))
    return match ? match[1] : null
  }
  const readCommand = () => {
    const name = peekCommand()
    if (name === null) return fail('A backslash needs a command after it')
    at += name.length + 1
    return name
  }
  const readRaw = () => {
    skip()
    if (source[at] !== '{') return fail('Expected {')
    const start = (at += 1)
    let depth = 1
    while (at < source.length && depth) {
      if (source[at] === '{') depth += 1
      else if (source[at] === '}') depth -= 1
      at += 1
    }
    if (depth) fail('Missing }')
    return source.slice(start, at - 1)
  }

  const expression = (stop: (command: string | null, char: string) => boolean): MathNode[] => {
    const nodes: MathNode[] = []
    for (;;) {
      skip()
      if (at >= source.length) return nodes
      const char = source[at]
      if (stop(char === '\\' ? peekCommand() : null, char)) return nodes
      nodes.push(scripted(atom()))
    }
  }

  const group = (): MathNode => {
    at += 1
    const inside = expression((_, char) => char === '}')
    if (source[at] !== '}') fail('Missing }')
    at += 1
    return inside.length ? row(inside) : { tag: 'mrow', children: [], plain: '' }
  }

  const argument = (): MathNode => {
    skip()
    if (at >= source.length) return fail('Missing argument')
    if (source[at] === '{') return group()
    if (/[0-9a-zA-Z]/.test(source[at])) return (at += 1), /\d/.test(source[at - 1]) ? leaf('mn', source[at - 1]) : leaf('mi', source[at - 1])
    return atom()
  }

  const scripted = (base: MathNode): MathNode => {
    let sub: MathNode | null = null
    let sup: MathNode | null = null
    for (;;) {
      skip()
      const char = source[at]
      if (char === '_' && !sub) (at += 1), (sub = argument())
      else if (char === '^' && !sup) (at += 1), (sup = argument())
      else if (char === "'") (at += 1), (sup = leaf('mo', '′'))
      else if (char === '_' || char === '^') fail(`Double ${char === '_' ? 'subscript' : 'superscript'}`)
      else break
    }
    if (!sub && !sup) return base
    const under = base.limits === 'under'
    const tag = sub && sup ? (under ? 'munderover' : 'msubsup') : sub ? (under ? 'munder' : 'msub') : under ? 'mover' : 'msup'
    const plain = `${base.text !== undefined ? base.plain : wrap(base.plain)}${sub ? `_${wrap(sub.plain)}` : ''}${sup ? `^${wrap(sup.plain)}` : ''}`
    return { tag, children: [base, ...(sub ? [sub] : []), ...(sup ? [sup] : [])], plain }
  }

  const fence = (): string => {
    skip()
    if (source[at] === '\\') {
      const name = readCommand()
      return OPERATORS[name] ?? fail(`\\${name} is not a delimiter`)
    }
    const char = source[at]
    if (!char || !'()[]|./'.includes(char)) return fail('\\left and \\right need a delimiter')
    at += 1
    return char === '.' ? '' : char
  }

  const atom = (): MathNode => {
    const char = source[at]
    if (char === '{') return group()
    if (char === '}') return fail('Unexpected }')
    if (char === '&' || (char === '\\' && source[at + 1] === '\\')) return fail(`${char === '&' ? '&' : '\\\\'} only works inside a matrix`)
    if (char === '^' || char === '_') return { tag: 'mrow', children: [], plain: '' }
    const number = /^\d+(\.\d+)?|^\.\d+/.exec(source.slice(at))
    if (number) return (at += number[0].length), leaf('mn', number[0])
    if (char !== '\\') {
      at += 1
      if (/\p{L}/u.test(char)) return leaf('mi', char)
      if (char === '-') return leaf('mo', '−', undefined, '−')
      if ('()[]|'.includes(char)) return leaf('mo', char, { stretchy: 'false' })
      return leaf('mo', char)
    }
    const start = at
    const name = readCommand()
    if (GREEK[name]) return leaf('mi', GREEK[name], name[0] === name[0].toUpperCase() ? { mathvariant: 'normal' } : undefined)
    if (IDENTIFIERS[name]) return leaf('mi', IDENTIFIERS[name])
    if (OPERATORS[name]) return leaf('mo', OPERATORS[name])
    if (BIG[name]) return { ...leaf('mo', BIG[name][0], { largeop: 'true', movablelimits: BIG[name][1] === 'under' ? 'true' : 'false' }), limits: BIG[name][1] }
    if (FUNCTIONS.has(name)) return leaf('mi', name, { mathvariant: 'normal' })
    if (LIMIT_FUNCTIONS.has(name)) return { ...leaf('mo', name, { movablelimits: 'true', form: 'prefix' }), limits: 'under' }
    if (name in SPACES) return leaf('mspace', '', { width: SPACES[name] }, ' ')
    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
      const [top, bottom] = [argument(), argument()]
      return { tag: 'mfrac', children: [top, bottom], plain: `${wrap(top.plain)}/${wrap(bottom.plain)}` }
    }
    if (name === 'binom') {
      const [top, bottom] = [argument(), argument()]
      return row([leaf('mo', '('), { tag: 'mfrac', attrs: { linethickness: '0' }, children: [top, bottom], plain: `${top.plain} choose ${bottom.plain}` }, leaf('mo', ')')])
    }
    if (name === 'sqrt') {
      skip()
      if (source[at] === '[') {
        at += 1
        const index = row(expression((_, next) => next === ']'))
        if (source[at] !== ']') fail('Missing ]')
        at += 1
        const radicand = argument()
        return { tag: 'mroot', children: [radicand, index], plain: `root(${index.plain}, ${radicand.plain})` }
      }
      const radicand = argument()
      return { tag: 'msqrt', children: [radicand], plain: `√${wrap(radicand.plain)}` }
    }
    if (name === 'text' || name === 'textrm' || name === 'mbox') {
      const text = readRaw()
      return leaf('mtext', text.replace(/ /g, ' '), undefined, text)
    }
    if (name === 'mathrm' || name === 'operatorname') return leaf('mi', readRaw().trim(), { mathvariant: 'normal' })
    if (name === 'mathbb') {
      const text = readRaw().trim()
      return leaf('mi', [...text].map((letter) => DOUBLE_STRUCK[letter] ?? letter).join(''), { mathvariant: 'normal' })
    }
    if (name === 'mathbf' || name === 'boldsymbol') {
      const inner = argument()
      return { tag: 'mrow', attrs: { style: { fontWeight: 'bold' } }, children: [inner], plain: inner.plain }
    }
    if (ACCENTS[name]) {
      const inner = argument()
      const wide = name === 'overline'
      return { tag: 'mover', attrs: { accent: 'true' }, children: [inner, leaf('mo', ACCENTS[name], { stretchy: wide ? 'true' : 'false' })], plain: `${name}(${inner.plain})` }
    }
    if (name === 'left') {
      const open = fence()
      const inside = expression((command) => command === 'right')
      if (peekCommand() !== 'right') fail('\\left without a matching \\right')
      readCommand()
      const close = fence()
      return row([leaf('mo', open, { fence: 'true', stretchy: 'true' }), ...inside, leaf('mo', close, { fence: 'true', stretchy: 'true' })])
    }
    if (name === 'begin') {
      const env = readRaw()
      if (!ENVIRONMENTS[env]) fail(`Unknown environment ${env}`)
      const rows: MathNode[][] = [[]]
      for (;;) {
        const cell = expression((command, next) => next === '&' || command === '\\' || command === 'end')
        rows[rows.length - 1].push(row(cell))
        if (at >= source.length) fail(`\\begin{${env}} without \\end{${env}}`)
        if (source[at] === '&') at += 1
        else if (peekCommand() === '\\') (at += 2), rows.push([])
        else break
      }
      readCommand()
      if (readRaw() !== env) fail(`\\end does not match \\begin{${env}}`)
      const filled = rows.filter((cells) => cells.some((cell) => cell.plain !== '' || cell.children?.length))
      const align = env === 'cases' ? 'left' : env === 'aligned' ? 'right left' : undefined
      const table: MathNode = {
        tag: 'mtable',
        attrs: align ? { columnalign: align } : undefined,
        children: filled.map((cells) => ({ tag: 'mtr', children: cells.map((cell) => ({ tag: 'mtd', children: [cell], plain: cell.plain })), plain: '' })),
        plain: `[${filled.map((cells) => cells.map((cell) => cell.plain).join(', ')).join('; ')}]`,
      }
      const [open, close] = ENVIRONMENTS[env]
      if (!open && !close) return table
      return row([...(open ? [leaf('mo', open, { fence: 'true' })] : []), table, ...(close ? [leaf('mo', close, { fence: 'true' })] : [])])
    }
    at = start
    return fail(`Unknown command \\${name}`)
  }

  const nodes = expression(() => false)
  return row(nodes)
}

function render(node: MathNode, key?: number): ReactNode {
  return createElement(node.tag, { key, ...node.attrs }, node.text ?? node.children?.map(render))
}

let mathMLSupport: boolean | null = null

/** Measures an mspace: a browser that lays out MathML gives it the size asked for. */
function detectMathML() {
  if (mathMLSupport !== null) return mathMLSupport
  const ns = 'http://www.w3.org/1998/Math/MathML'
  const probe = document.createElementNS(ns, 'math')
  const space = document.createElementNS(ns, 'mspace')
  space.setAttribute('height', '23px')
  space.setAttribute('width', '77px')
  probe.append(space)
  probe.setAttribute('style', 'position:absolute;visibility:hidden')
  document.body.append(probe)
  const box = space.getBoundingClientRect()
  probe.remove()
  mathMLSupport = Math.abs(box.width - 77) <= 1 && Math.abs(box.height - 23) <= 1
  return mathMLSupport
}

/**
 * Typeset maths from a TeX-like source, rendered as native MathML.
 *
 * The browser does the typesetting and a screen reader reads the structure —
 * “fraction, numerator …” — which is what a picture of an equation or a span
 * soup of positioned glyphs cannot give. The parser covers the subset that
 * product and teaching pages actually use: fractions, roots, scripts, Greek,
 * sums and integrals with limits, matrices and cases, operators, and \text.
 *
 * A mistake in the source is shown in place, with where it went wrong, rather
 * than breaking the page. Where the browser cannot lay out MathML, the same
 * formula is written out as linear text — “(−b ± √(b^2 − 4ac))/(2a)” — which
 * is less pretty and still correct. The text form is also the formula’s
 * `alttext`.
 */
export function MathFormula({ tex, display = false, render: mode = 'auto', onError, className }: MathFormulaProps) {
  const result = useMemo(() => {
    try {
      return { node: parse(tex), error: null }
    } catch (error) {
      if (error instanceof MathFormulaError) return { node: null, error }
      throw error
    }
  }, [tex])
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (mode === 'auto') setSupported(detectMathML())
  }, [mode])

  useEffect(() => {
    if (result.error) onError?.(result.error.message)
  }, [result.error, onError])

  if (result.error) {
    return (
      <span className={cn('inline-flex flex-wrap items-baseline gap-x-1.5 rounded-[var(--radius-6)] bg-[color-mix(in_oklab,var(--color-danger)_10%,transparent)] px-1.5 py-0.5 text-[12px] font-medium text-danger', display && 'flex', className)}>
        <code className="font-mono">
          {tex.slice(0, result.error.at)}
          <mark className="rounded-[var(--radius-3)] bg-danger px-px text-ink-inverse">{tex.slice(result.error.at, result.error.at + 1) || '␣'}</mark>
          {tex.slice(result.error.at + 1)}
        </code>
        <span>{result.error.message}.</span>
      </span>
    )
  }

  const node = result.node!
  const text = mode === 'text' || (mode === 'auto' && !supported)

  if (text) {
    return (
      <span role="math" aria-label={node.plain} className={cn('font-serif text-ink', display ? 'my-3 block text-center text-[1.15em]' : 'inline', className)}>
        {node.plain}
      </span>
    )
  }

  const math = createElement(
    'math',
    { display: display ? 'block' : 'inline', alttext: node.plain, className: cn('text-ink', display ? 'text-[1.15em]' : '', !display && className) },
    render(node),
  )
  return display ? <div className={cn('my-3 max-w-full overflow-x-auto py-1', className)}>{math}</div> : math
}
