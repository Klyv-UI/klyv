import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Copy } from 'lucide-react'
import { Reveal, Text, VisuallyHidden, cn } from 'klyv'
import { brand } from '../../brand'
import { Eyebrow } from '../../components/Eyebrow'

/**
 * The landing page's own vocabulary: one section shell, one eyebrow, one quiet
 * link, one install command. Every section is built from these, so the page
 * keeps a single rhythm — the same gutters, the same heading scale, the same
 * gap between a heading and what it introduces.
 */

export const kb = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 10240 ? 2 : 1)} kB`

/** Where an element falls in the page's entrance; `.landing-enter` reads it. */
export const enter = (ms: number) => ({ '--enter-delay': `${ms}ms` }) as CSSProperties

/** The quiet "more of this" link, used under tiles and beside section headings. */
export function SectionLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'group inline-flex min-h-6 items-center gap-1 self-start rounded-md px-0.5 text-[12.5px] font-bold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        className,
      )}
    >
      {children}
      <ArrowRight
        size={12}
        aria-hidden
        className="text-ink-faint transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </Link>
  )
}

/**
 * One section: eyebrow, heading, a short lede and an optional link, centred
 * over the content, at the content width.
 *
 * Odd-numbered sections sit in a rounded panel and even-numbered ones sit
 * open on the page, so the page alternates — one contained, one not — and
 * separates its sections without boxing every one of them in. Both share the
 * same width and inner padding, so content lines up whichever it is. `band`
 * lifts a panel a shade and lights its top edge with the accent.
 *
 * The heading scale steps down once from the hero — 64–70px there, 44px here,
 * 16px on a card — and the lede and card copy share one reading size, so every
 * section settles into the same three levels.
 */
export function LandingSection({
  id,
  index,
  eyebrow,
  title,
  tail,
  lede,
  action,
  band = false,
  children,
}: {
  /** The anchor, and the base of the heading's id. */
  id: string
  /** The section's place on the page, shown before the eyebrow as 01, 02… */
  index?: number
  eyebrow: string
  title: ReactNode
  /** The rest of the heading, set in a quieter ink: the statement, then its turn. */
  tail?: string
  lede?: ReactNode
  action?: ReactNode
  band?: boolean
  children: ReactNode
}) {
  const titleId = `${id}-title`
  const panel = index === undefined || index % 2 === 1
  return (
    <section id={id} aria-labelledby={titleId} className="scroll-mt-20 px-3 py-1.5 sm:px-4 lg:scroll-mt-36 lg:px-5">
      <div
        className={cn(
          'mx-auto w-full max-w-[1400px]',
          panel && 'landing-panel rounded-[var(--radius-window)] border border-line',
          panel && band && 'landing-panel-band',
        )}
      >
        <div className="px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
          <Reveal>
            <header className="mx-auto mb-10 flex max-w-[860px] flex-col items-center text-center lg:mb-14">
              <div className="flex flex-col items-center">
                <Eyebrow>
                  {index !== undefined && (
                    <span aria-hidden className="mr-2 tabular-nums text-ink-faint">
                      {String(index).padStart(2, '0')} /
                    </span>
                  )}
                  {eyebrow}
                </Eyebrow>
                <Text
                  as="h2"
                  id={titleId}
                  size="title"
                  className="mt-4 max-w-[24ch] text-balance text-[32px] leading-[1.04] tracking-[-0.045em] sm:text-[44px] lg:text-[52px]"
                >
                  {title}
                  {tail && <span className="text-ink-faint"> {tail}</span>}
                </Text>
                {lede && (
                  <Text
                    size="body"
                    weight="medium"
                    tone="soft"
                    className="mt-5 max-w-[60ch] text-balance text-[15px] leading-relaxed sm:text-[17px]"
                  >
                    {lede}
                  </Text>
                )}
              </div>
              {action && <div className="mt-5">{action}</div>}
            </header>
          </Reveal>
          {children}
        </div>
      </div>
    </section>
  )
}

/** `$ npm i klyv`, copyable, with the result announced. */
export function InstallCommand({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false)
  const command = `npm i ${brand.pkg}`

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(command)
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        } catch {
          setCopied(false)
        }
      }}
      className={cn(
        'group inline-flex h-10 items-center justify-between gap-5 rounded-full border border-line bg-surface pl-4 pr-3 font-mono text-[12.5px] font-semibold text-ink-soft shadow-[var(--shadow-tile)] transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        className,
      )}
    >
      <span>
        <span className="text-ink-faint">$</span> {command}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-1 font-sans text-[10px] font-bold uppercase tracking-wider text-ink-soft transition-colors group-hover:text-ink">
        {copied ? <Check size={11} strokeWidth={3} aria-hidden /> : <Copy size={11} strokeWidth={2.5} aria-hidden />}
        {copied ? 'Copied' : 'Copy'}
      </span>
      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {copied ? 'Copied to clipboard' : ''}
        </span>
      </VisuallyHidden>
    </button>
  )
}

/** The three window controls, drawn in line colour: chrome, not decoration. */
export function WindowDots() {
  return (
    <span aria-hidden className="flex shrink-0 gap-1.5">
      <span className="size-2.5 rounded-full bg-line-strong" />
      <span className="size-2.5 rounded-full bg-line-strong" />
      <span className="size-2.5 rounded-full bg-line-strong" />
    </span>
  )
}

/** One derived accent token: its name, its value, and the colour itself. */
export function TokenSwatch({ token, value, compact = false }: { token: string; value: string; compact?: boolean }) {
  return (
    <div className={cn('flex gap-2', compact ? 'items-center' : 'flex-col')}>
      <span
        aria-hidden
        className={cn('shrink-0 border border-line', compact ? 'size-7 rounded-[8px]' : 'h-14 rounded-[var(--radius-tile)]')}
        style={{ background: value }}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <Text size="micro" weight="bold" className="truncate font-mono">
          {token}
        </Text>
        <Text size="micro" tone="faint" className="font-mono uppercase">
          {value}
        </Text>
      </div>
    </div>
  )
}
