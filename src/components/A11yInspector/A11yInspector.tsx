'use client'

import { useCallback, useEffect, useState, type RefObject } from 'react'
import { cn } from '../../lib/cn'
import { contrastRatio } from '../../lib/contrast'
import { Button } from '../Button'
import { Portal } from '../Portal'
import { Switch } from '../Switch'
import { Text } from '../Text'

export type A11yInspectorRule =
  | 'image-alt'
  | 'control-name'
  | 'button-name'
  | 'link-name'
  | 'heading-order'
  | 'tabindex'
  | 'contrast'
  | 'duplicate-id'

export interface A11yInspectorIssue {
  rule: A11yInspectorRule
  element: Element
  message: string
}

export interface A11yInspectorProps {
  /** The subtree to audit. */
  target: RefObject<HTMLElement | null>
  /** Which checks to run. All of them by default. */
  rules?: A11yInspectorRule[]
  /** Audit once on mount. Otherwise the reader starts it. */
  autoRun?: boolean
  /** Draw numbered badges over offending elements. The reader can toggle it. */
  defaultShowBadges?: boolean
  /** Called with every audit’s findings. */
  onAudit?: (issues: A11yInspectorIssue[]) => void
  /** Merged last, so it wins. */
  className?: string
}

const ALL: A11yInspectorRule[] = ['image-alt', 'control-name', 'button-name', 'link-name', 'heading-order', 'tabindex', 'contrast', 'duplicate-id']

const RULE_LABEL: Record<A11yInspectorRule, string> = {
  'image-alt': 'Image alt text',
  'control-name': 'Form control names',
  'button-name': 'Button names',
  'link-name': 'Link names',
  'heading-order': 'Heading order',
  tabindex: 'Positive tabindex',
  contrast: 'Text contrast',
  'duplicate-id': 'Duplicate ids',
}

const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim()

function hidden(element: Element): boolean {
  if (element.closest('[hidden], [aria-hidden="true"], [inert]')) return true
  const style = getComputedStyle(element)
  return style.display === 'none' || style.visibility === 'hidden'
}

/** The text an element contributes to a name — its text, image alts and child aria-labels, skipping hidden parts. */
function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof Element) || node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('hidden')) return ''
  const label = node.getAttribute('aria-label')
  if (label && clean(label)) return ` ${label} `
  if (node.tagName === 'IMG') return ` ${node.getAttribute('alt') ?? ''} `
  if (node instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(node.type)) return ` ${node.value} `
  return Array.from(node.childNodes, textOf).join('')
}

/**
 * The accessible name, following the order of the accname spec closely enough
 * for an audit: aria-labelledby, aria-label, native labels and alt, content for
 * roles that take their name from it, then title and placeholder.
 */
function accessibleName(element: Element): string {
  const labelledby = element.getAttribute('aria-labelledby')
  if (labelledby) {
    // Ids resolve within the element’s own tree, which is a shadow root when it lives in one.
    const scope = element.getRootNode() as Document | ShadowRoot
    const text = clean(labelledby.split(/\s+/).map((id) => { const node = scope.getElementById?.(id); return node ? textOf(node) : '' }).join(' '))
    if (text) return text
  }
  const label = clean(element.getAttribute('aria-label'))
  if (label) return label
  if (element instanceof HTMLInputElement) {
    if (['button', 'submit', 'reset'].includes(element.type)) return clean(element.value) || (element.type === 'button' ? '' : element.type === 'submit' ? 'Submit' : 'Reset')
    if (element.type === 'image') return clean(element.alt)
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    const labels = clean(Array.from(element.labels ?? [], textOf).join(' '))
    if (labels) return labels
  }
  if (element.tagName === 'IMG') return clean(element.getAttribute('alt'))
  const role = element.getAttribute('role')
  if (/^(BUTTON|A|H[1-6]|SUMMARY)$/.test(element.tagName) || /^(button|link|heading|tab|menuitem|option|checkbox|radio|switch)$/.test(role ?? '')) {
    const text = clean(textOf(element))
    if (text) return text
  }
  return clean(element.getAttribute('title')) || clean(element.getAttribute('placeholder'))
}

type Rgba = [number, number, number, number]
let paint: CanvasRenderingContext2D | null | undefined

/** Any CSS colour to RGBA — rgb() by hand, everything else (oklch, color-mix…) through a 1px canvas. */
function rgba(color: string): Rgba | null {
  const match = /^rgba?\(([^)]+)\)$/.exec(color.trim())
  if (match) {
    const parts = match[1].split(/[\s,/]+/).filter(Boolean).map((part) => (part.endsWith('%') ? (Number.parseFloat(part) / 100) * 255 : Number.parseFloat(part)))
    if (parts.length >= 3 && parts.every(Number.isFinite)) return [parts[0], parts[1], parts[2], parts[3] ?? 1]
  }
  if (paint === undefined) paint = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!paint) return null
  paint.clearRect(0, 0, 1, 1)
  paint.fillStyle = 'transparent'
  paint.fillStyle = color
  paint.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data
  return [r, g, b, a / 255]
}

const over = (top: Rgba, bottom: Rgba): Rgba => {
  const a = top[3] + bottom[3] * (1 - top[3])
  if (a === 0) return [0, 0, 0, 0]
  const mix = (i: number) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a
  return [mix(0), mix(1), mix(2), a]
}

const toHex = ([r, g, b]: Rgba) => '#' + [r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')

/** The colour behind an element: backgrounds stacked up to the first opaque one, over white. Null when an image is in the way. */
function backdrop(element: Element): Rgba | null {
  const layers: Rgba[] = []
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (style.backgroundImage && style.backgroundImage !== 'none') return null
    const color = rgba(style.backgroundColor)
    if (!color) return null
    if (color[3] > 0) layers.push(color)
    if (color[3] >= 1) break
  }
  return layers.reduceRight<Rgba>((below, layer) => over(layer, below), [255, 255, 255, 1])
}

function audit(root: HTMLElement, rules: A11yInspectorRule[]): A11yInspectorIssue[] {
  const on = new Set(rules)
  const issues: A11yInspectorIssue[] = []
  const add = (rule: A11yInspectorRule, element: Element, message: string) => issues.push({ rule, element, message })
  const all = (selector: string) => Array.from(root.querySelectorAll(selector)).filter((element) => !hidden(element))

  if (on.has('image-alt')) {
    for (const image of all('img, [role="img"]')) {
      const role = image.getAttribute('role')
      if (role === 'presentation' || role === 'none') continue
      if (image.tagName === 'IMG' && !image.hasAttribute('alt') && !accessibleName(image)) add('image-alt', image, 'Image has no alt attribute. Use alt="" if it is decorative.')
      else if (image.tagName !== 'IMG' && !accessibleName(image)) add('image-alt', image, 'Element with role="img" has no accessible name.')
    }
  }
  if (on.has('control-name')) {
    const controls = 'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea, [role="textbox"], [role="combobox"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"], [role="spinbutton"], [role="searchbox"]'
    for (const control of all(controls)) {
      if (!accessibleName(control)) add('control-name', control, `${control.tagName.toLowerCase()}${control.getAttribute('type') ? ` type="${control.getAttribute('type')}"` : ''} has no label.`)
    }
  }
  if (on.has('button-name')) {
    for (const button of all('button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]')) {
      if (!accessibleName(button)) add('button-name', button, 'Button has no accessible name — an icon alone is not one.')
    }
  }
  if (on.has('link-name')) {
    for (const link of all('a[href], [role="link"]')) {
      if (!accessibleName(link)) add('link-name', link, 'Link has no accessible name.')
    }
  }
  if (on.has('heading-order')) {
    let previous = 0
    for (const heading of all('h1, h2, h3, h4, h5, h6, [role="heading"]')) {
      const level = /^H[1-6]$/.test(heading.tagName) ? Number(heading.tagName[1]) : Number(heading.getAttribute('aria-level') ?? 2)
      if (previous && level > previous + 1) add('heading-order', heading, `Heading level ${level} follows level ${previous}, skipping ${previous + 1}.`)
      previous = level
    }
  }
  if (on.has('tabindex')) {
    for (const element of all('[tabindex]')) {
      const value = Number.parseInt(element.getAttribute('tabindex') ?? '', 10)
      if (value > 0) add('tabindex', element, `tabindex="${value}" moves this ahead of the page’s natural tab order.`)
    }
  }
  if (on.has('contrast')) {
    for (const element of all('*')) {
      const text = Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && clean(node.textContent))
      if (!text) continue
      const style = getComputedStyle(element)
      const ink = rgba(style.color)
      const back = backdrop(element)
      if (!ink || !back) continue
      const ratio = contrastRatio(toHex(over(ink, back)), toHex(back))
      const size = Number.parseFloat(style.fontSize) || 16
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
      const needed = large ? 3 : 4.5
      if (ratio < needed) add('contrast', element, `Text contrast is ${ratio.toFixed(2)}:1; ${large ? 'large' : 'body'} text needs ${needed}:1.`)
    }
  }
  if (on.has('duplicate-id')) {
    const seen = new Map<string, number>()
    for (const element of Array.from(root.querySelectorAll('[id]'))) {
      const count = (seen.get(element.id) ?? 0) + 1
      seen.set(element.id, count)
      if (count === 2) add('duplicate-id', element, `id="${element.id}" is used more than once, so labels and references pointing at it are ambiguous.`)
    }
  }
  // Document order, so badge numbers read top to bottom.
  return issues.sort((a, b) => (a.element === b.element ? 0 : a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
}

function describe(element: Element) {
  const id = element.id ? `#${element.id}` : ''
  const name = clean(textOf(element)).slice(0, 32)
  return `<${element.tagName.toLowerCase()}${id}>${name ? ` “${name}”` : ''}`
}

function focusIssue(element: Element) {
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) return
  if (element.tabIndex < 0 && !element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '-1')
    element.addEventListener('blur', () => element.removeAttribute('tabindex'), { once: true })
  }
  element.scrollIntoView?.({ block: 'center', behavior: 'auto' })
  element.focus({ preventScroll: true })
}

/**
 * An accessibility audit of one part of the page, drawn on the page itself.
 *
 * It runs its own checks against the live DOM rather than a copy: images
 * without alt, controls, buttons and links with no accessible name (computed
 * from aria-labelledby, aria-label, labels, content and title, as a screen
 * reader would), skipped heading levels, positive tabindex, duplicate ids, and
 * text whose contrast against its actual painted background falls below WCAG
 * AA. Each finding is numbered on the element it concerns and listed below;
 * choosing one moves focus to the element, so a keyboard user can check the
 * fix the same way the problem would be met. Audits are cheap enough to re-run
 * after every edit.
 */
export function A11yInspector({ target, rules = ALL, autoRun = true, defaultShowBadges = true, onAudit, className }: A11yInspectorProps) {
  const [issues, setIssues] = useState<A11yInspectorIssue[] | null>(null)
  const [showBadges, setShowBadges] = useState(defaultShowBadges)
  const [rects, setRects] = useState<DOMRect[]>([])
  const [active, setActive] = useState<number | null>(null)
  const ruleKey = rules.join()

  const run = useCallback(() => {
    const root = target.current
    if (!root) return
    const found = audit(root, ruleKey.split(',') as A11yInspectorRule[])
    setIssues(found)
    setActive(null)
    onAudit?.(found)
  }, [target, ruleKey, onAudit])

  useEffect(() => {
    if (autoRun) run()
    // Once, on mount — re-running on every render would fight the reader’s edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Badges follow their elements through scrolling and resizing.
  useEffect(() => {
    if (!issues?.length || !showBadges) return
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setRects(issues.map((issue) => issue.element.getBoundingClientRect())))
    }
    setRects(issues.map((issue) => issue.element.getBoundingClientRect()))
    addEventListener('scroll', measure, true)
    addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('scroll', measure, true)
      removeEventListener('resize', measure)
    }
  }, [issues, showBadges])

  const counts = ALL.filter((rule) => rules.includes(rule)).map((rule) => [rule, issues?.filter((issue) => issue.rule === rule).length ?? 0] as const)

  return (
    <div className={cn('flex flex-col gap-3 rounded-[var(--radius-tile)] border border-line bg-surface p-4', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <Text as="span" size="body" weight="bold" role="status" className="mr-auto">
          {issues === null ? 'Not audited yet' : issues.length === 0 ? 'No issues found' : `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'} found`}
        </Text>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={showBadges} onChange={(event) => setShowBadges(event.target.checked)} />
          Badges
        </label>
        <Button size="sm" variant="muted" onClick={run}>
          {issues === null ? 'Run audit' : 'Re-run'}
        </Button>
      </div>

      {issues !== null && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Checks">
          {counts.map(([rule, count]) => (
            <li key={rule} className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', count ? 'bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] text-danger' : 'bg-surface-muted text-ink-soft')}>
              {`${RULE_LABEL[rule]} · ${count || 'pass'}`}
            </li>
          ))}
        </ul>
      )}

      {issues && issues.length > 0 && (
        <ol className="flex flex-col divide-y divide-line rounded-[var(--radius-tile)] border border-line">
          {issues.map((issue, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => {
                  setActive(index)
                  focusIssue(issue.element)
                }}
                className={cn('flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-surface-muted', active === index && 'bg-surface-muted')}
              >
                <span aria-hidden="true" className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[12px] font-semibold text-ink">{issue.message}</span>
                  <span className="break-all font-mono text-[11px] text-ink-faint">{`${index + 1}. ${RULE_LABEL[issue.rule]} · ${describe(issue.element)}`}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {showBadges && issues && issues.length > 0 && (
        <Portal>
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40">
            {rects.map((rect, index) =>
              rect.width + rect.height === 0 ? null : (
                <div key={index} className="absolute" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
                  <span className={cn('absolute inset-0 rounded-[var(--radius-3)] outline-2 outline-offset-1 outline-danger', active === index ? 'outline' : 'outline-dashed')} />
                  <span className={cn('absolute -left-2 -top-2 flex size-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white shadow-[var(--shadow-float)]', active === index && 'ring-2 ring-ink')}>
                    {index + 1}
                  </span>
                </div>
              ),
            )}
          </div>
        </Portal>
      )}
    </div>
  )
}
