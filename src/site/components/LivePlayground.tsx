import { Component, createElement, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, CodeBlock, Text } from 'klyv'
import { Section } from './Doc'
import { NumberControl, Playground, SelectControl, TextControl, ToggleControl } from './Playground'
import { cachedProps, type GeneratedProp } from '../data/props'
import { componentNamed, type AnyComponent } from '../lib/registry'

/**
 * Live controls for any component page, with nothing written per component.
 *
 * The starting point is the first example already on the page: its props — the
 * data, the items, the handlers — are read off React's rendered tree, so the
 * playground begins from something real rather than from invented sample
 * data. The controls come from the component's generated props type: every
 * boolean, number, string and union of literals gets one. Props that take data
 * or callbacks keep the example's values.
 *
 * Controlled props are wired back: when the component reports a change
 * (onChange, onValueChange, onOpenChange, onClose…) the playground keeps the
 * new value, so a tab switches and a dialog closes as they would in an app.
 */

type Props = Record<string, unknown>

type Control =
  | { kind: 'boolean'; name: string }
  | { kind: 'select'; name: string; options: string[]; numeric: boolean }
  | { kind: 'number'; name: string; min: number; max: number; step: number }
  | { kind: 'text'; name: string }

/** Styling hooks, identity, and the values the component itself reports back. */
const SKIP = new Set([
  'className',
  'style',
  'id',
  'as',
  'ref',
  'name',
  'tabIndex',
  'value',
  'checked',
  'selected',
  'defaultValue',
  'defaultChecked',
])

const LITERAL = String.raw`'[^']*'|-?\d+(?:\.\d+)?`
const LITERAL_UNION = new RegExp(`^(?:${LITERAL})(?:\\s*\\|\\s*(?:${LITERAL}))*$`)
const NONE = '(default)'

function parseDefault(text: string | undefined): unknown {
  if (text === undefined) return undefined
  if (text === 'true' || text === 'false') return text === 'true'
  if (/^'.*'$/.test(text)) return text.slice(1, -1)
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text)
  return undefined
}

function numberRange(name: string, value: unknown): { min: number; max: number; step: number } {
  const current = typeof value === 'number' ? value : 0
  if ((current > 0 && current < 1) || /opacity|ratio|intensity|strength/i.test(name)) {
    return { min: 0, max: 1, step: 0.05 }
  }
  const magnitude = Math.max(10, Math.ceil(Math.abs(current) * 3))
  return { min: current < 0 ? -magnitude : 0, max: magnitude, step: Number.isInteger(current) ? 1 : 0.1 }
}

function controlFor(prop: GeneratedProp, base: Props): Control | null {
  if (SKIP.has(prop.name) || /^on[A-Z]/.test(prop.name)) return null
  const type = prop.type.replace(/\s*\|\s*undefined\b/g, '').trim()
  const start = base[prop.name] ?? parseDefault(prop.defaultValue)

  if (type === 'boolean') return { kind: 'boolean', name: prop.name }
  if (type === 'number') return { kind: 'number', name: prop.name, ...numberRange(prop.name, start) }
  if (LITERAL_UNION.test(type)) {
    const options = type.split('|').map((option) => option.trim().replace(/^'|'$/g, ''))
    return { kind: 'select', name: prop.name, options, numeric: !type.includes("'") }
  }
  if (type === 'string') return { kind: 'text', name: prop.name }
  // Rich slots stay as the example wrote them, unless the example put text there.
  if (/\b(ReactNode|string)\b/.test(type) && typeof base[prop.name] === 'string') {
    return { kind: 'text', name: prop.name }
  }
  return null
}

/* ----------------------------------------------------- the rendered tree */

interface Fiber {
  type: unknown
  elementType: unknown
  memoizedProps: unknown
  stateNode: unknown
  child: Fiber | null
  sibling: Fiber | null
}

/** An element the example sat inside that its markup depends on: a list for a list item, a table for a row. */
interface Wrapper {
  tag: string
  role: string | null
}

interface Example {
  props: Props
  wrappers: Wrapper[]
}

const STRUCTURAL_TAGS = new Set(['UL', 'OL', 'MENU', 'DL', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'SELECT', 'OPTGROUP'])
const STRUCTURAL_ROLES = new Set([
  'list',
  'listbox',
  'menu',
  'menubar',
  'tablist',
  'tree',
  'treegrid',
  'grid',
  'table',
  'row',
  'rowgroup',
  'radiogroup',
])

function fiberOf(node: Element): Fiber | undefined {
  const key = Object.keys(node).find((name) => name.startsWith('__reactFiber$'))
  return key ? (node as unknown as Record<string, Fiber>)[key] : undefined
}

/** Depth first from `root` and its siblings, the first fiber that passes. */
function findFiber(root: Fiber | null, test: (fiber: Fiber) => boolean): Fiber | null {
  const stack = root ? [root] : []
  while (stack.length > 0) {
    const fiber = stack.pop()!
    if (test(fiber)) return fiber
    if (fiber.sibling) stack.push(fiber.sibling)
    if (fiber.child) stack.push(fiber.child)
  }
  return null
}

/** The structural parents a component's first element sat in, outermost first. */
function structuralParents(element: Element | null): Wrapper[] {
  const chain: Wrapper[] = []
  for (let parent = element?.parentElement; parent; parent = parent.parentElement) {
    const role = parent.getAttribute('role')
    if (!STRUCTURAL_TAGS.has(parent.tagName) && !(role && STRUCTURAL_ROLES.has(role))) break
    chain.unshift({ tag: parent.tagName.toLowerCase(), role })
  }
  return chain
}

function firstExample(article: Element, component: AnyComponent): Example | null {
  for (const section of article.querySelectorAll(':scope > section')) {
    const fiber = fiberOf(section)
    const found = fiber ? findFiber(fiber.child, (candidate) => candidate.elementType === component) : null
    if (!found) continue
    const host = findFiber(found.child, (candidate) => typeof candidate.type === 'string')
    const element = host?.stateNode instanceof Element ? host.stateNode : null
    return { props: found.memoizedProps as Props, wrappers: structuralParents(element) }
  }
  return null
}

/* ------------------------------------------------------------ landmarks */

const LANDMARKS = [
  'nav',
  'aside',
  'main',
  'header',
  'footer',
  'search',
  'form[aria-label]',
  'form[aria-labelledby]',
  'section[aria-label]',
  'section[aria-labelledby]',
  '[role="navigation"]',
  '[role="search"]',
  '[role="region"]',
  '[role="complementary"]',
  '[role="main"]',
  '[role="form"]',
  '[role="banner"]',
  '[role="contentinfo"]',
].join(', ')

const SUFFIX = ' (playground)'

/**
 * The stage is a second copy of the first example, so every landmark in it
 * would share a name with its twin further down the page, and a screen reader
 * listing landmarks would offer two identical entries. Each one in the stage
 * is named as the playground's own.
 */
function nameLandmarks(stage: Element, component: string): void {
  for (const element of stage.querySelectorAll(LANDMARKS)) {
    let label = element.getAttribute('aria-label')
    const labelledBy = element.getAttribute('aria-labelledby')
    if (labelledBy) {
      label = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ')
      element.removeAttribute('aria-labelledby')
    }
    if (label?.endsWith(SUFFIX)) continue
    element.setAttribute('aria-label', `${label || component}${SUFFIX}`)
  }
}

/* --------------------------------------------------------------- wiring */

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

const isEvent = (value: unknown): value is { target: { value?: unknown; checked?: unknown } } =>
  typeof value === 'object' && value !== null && 'target' in value && 'nativeEvent' in value

/**
 * Replaces the handlers that report a controlled value, so the value lands in
 * the playground's own state. Every other handler is the example's, untouched.
 */
function wire(base: Props, set: (name: string, value: unknown) => void): Props {
  const wired: Props = {}
  for (const [key, handler] of Object.entries(base)) {
    if (typeof handler !== 'function' || !/^on[A-Z]/.test(key)) continue

    let target: string | null = null
    if (key === 'onChange') target = 'checked' in base ? 'checked' : 'value' in base ? 'value' : null
    else if (key === 'onClose' || key === 'onDismiss') target = 'open' in base ? 'open' : null
    else if (key.endsWith('Change')) {
      const name = lowerFirst(key.slice(2, -'Change'.length))
      target = name in base ? name : null
    }
    if (!target) continue

    const name = target
    wired[key] = (...args: unknown[]) => {
      const [first] = args
      if (key === 'onClose' || key === 'onDismiss') set(name, false)
      else if (isEvent(first)) set(name, name === 'checked' ? first.target.checked : first.target.value)
      else set(name, first)
    }
  }
  return wired
}

/* ------------------------------------------------------------- snippet */

function snippet(name: string, values: Props, touched: Set<string>): string {
  const attributes = [...touched]
    .filter((key) => values[key] !== undefined)
    .map((key) => {
      const value = values[key]
      if (value === true) return key
      if (typeof value === 'string') return `${key}="${value.replace(/"/g, '&quot;')}"`
      return `${key}={${JSON.stringify(value)}}`
    })
  return attributes.length > 0 ? `<${name} ${attributes.join(' ')} />` : ''
}

/* ------------------------------------------------------------ component */

export function LivePlayground({ name }: { name: string }) {
  const anchor = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const component = componentNamed(name)
  const [example, setExample] = useState<Example | null>(null)
  const [values, setValues] = useState<Props>({})
  const [touched, setTouched] = useState<Set<string>>(() => new Set())
  const [generation, setGeneration] = useState(0)
  // Bumped on every change, so a combination that threw gets another try.
  const [revision, setRevision] = useState(0)
  const base = example?.props ?? null

  // Read before paint, so the section appears in the same frame as the page.
  // A few examples render their component one tick after mounting, hence the
  // second look.
  useLayoutEffect(() => {
    const article = anchor.current?.closest('article')
    if (!article || !component) return
    const found = firstExample(article, component)
    if (found) {
      setExample(found)
      return
    }
    const retry = window.setTimeout(() => {
      const late = firstExample(article, component)
      if (late) setExample(late)
    }, 120)
    return () => window.clearTimeout(retry)
  }, [component])

  // Kept up as the component re-renders itself: a board that recounts its
  // cards writes a new label, which is named again here.
  useLayoutEffect(() => {
    const element = stage.current
    if (!element) return
    nameLandmarks(element, name)
    const observer = new MutationObserver(() => nameLandmarks(element, name))
    observer.observe(element, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-label', 'aria-labelledby'],
    })
    return () => observer.disconnect()
  }, [example, name])

  const controls = useMemo(() => {
    if (!base) return []
    const api = cachedProps(name)
    const found = (api?.props ?? []).map((prop) => controlFor(prop, base)).filter((c): c is Control => c !== null)
    if (typeof base.children === 'string' && !found.some((control) => control.name === 'children')) {
      found.push({ kind: 'text', name: 'children' })
    }
    return found
  }, [base, name])

  const setFromComponent = useMemo(
    () => (key: string, value: unknown) => {
      setValues((previous) => ({ ...previous, [key]: value }))
      setRevision((value) => value + 1)
    },
    [],
  )
  const wired = useMemo(() => (base ? wire(base, setFromComponent) : {}), [base, setFromComponent])

  if (!component || !example || !base || controls.length === 0) return <div ref={anchor} hidden />

  const api = cachedProps(name)
  const defaults = new Map(api?.props.map((prop) => [prop.name, parseDefault(prop.defaultValue)]) ?? [])
  const current = (key: string) => (key in values ? values[key] : (base[key] ?? defaults.get(key)))

  const setFromControl = (key: string, value: unknown) => {
    setValues((previous) => ({ ...previous, [key]: value }))
    setTouched((previous) => new Set(previous).add(key))
    setRevision((value) => value + 1)
  }
  const reset = () => {
    setValues({})
    setTouched(new Set())
    setGeneration((value) => value + 1)
  }

  const code = snippet(name, values, touched)
  const Live = component
  // The example's list, table or tablist around it, so the stage's markup is
  // as valid as the example's.
  const staged = example.wrappers.reduceRight<ReactNode>(
    (child, wrapper) =>
      createElement(wrapper.tag, { role: wrapper.role ?? undefined, className: 'm-0 list-none p-0' }, child),
    <Live key={generation} {...base} {...wired} {...values} />,
  )

  return (
    <Section
      title="Playground"
      description="Starts from the first example below. Every control comes from the props type; props that take data or callbacks keep the example's values."
    >
      <div ref={anchor} hidden />
      <Playground
        background="app"
        stage={
          <div ref={stage} className="flex w-full min-w-0 max-w-full justify-center overflow-x-auto">
            <StageBoundary resetKey={`${generation}:${revision}`}>{staged}</StageBoundary>
          </div>
        }
        controls={
          <>
            {controls.map((control) => (
              <ControlField key={control.name} control={control} value={current(control.name)} onChange={(value) => setFromControl(control.name, value)} />
            ))}
            <Button size="sm" variant="ghost" onClick={reset} disabled={touched.size === 0 && Object.keys(values).length === 0} className="self-start">
              Reset
            </Button>
          </>
        }
      />
      {code ? (
        <CodeBlock language="tsx" code={code} />
      ) : (
        <Text size="caption" tone="faint">
          Change a control and the JSX for it appears here.
        </Text>
      )}
    </Section>
  )
}

function ControlField({ control, value, onChange }: { control: Control; value: unknown; onChange: (value: unknown) => void }) {
  switch (control.kind) {
    case 'boolean':
      return <ToggleControl label={control.name} checked={value === true} onChange={onChange} />
    case 'number':
      return (
        <NumberControl
          label={control.name}
          value={typeof value === 'number' ? value : control.min}
          min={control.min}
          max={control.max}
          step={control.step}
          onChange={onChange}
        />
      )
    case 'select': {
      const options = value === undefined ? [NONE, ...control.options] : control.options
      return (
        <SelectControl
          label={control.name}
          value={value === undefined ? NONE : String(value)}
          options={options}
          onChange={(next) => {
            if (next === NONE) return
            onChange(control.numeric ? Number(next) : next)
          }}
        />
      )
    }
    case 'text':
      return <TextControl label={control.name} value={typeof value === 'string' ? value : ''} onChange={onChange} />
  }
}

/** A combination of props the component rejects shows as a message, not a blank page. */
class StageBoundary extends Component<{ resetKey: string; children: ReactNode }, { error: string | null; key: string }> {
  state = { error: null as string | null, key: this.props.resetKey }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message }
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { error: string | null; key: string }) {
    return props.resetKey === state.key ? null : { error: null, key: props.resetKey }
  }

  render() {
    if (this.state.error) {
      return (
        <Text size="caption" tone="soft" leading="normal" className="max-w-[40ch] text-center">
          This combination throws: {this.state.error}
        </Text>
      )
    }
    return this.props.children
  }
}
