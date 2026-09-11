import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Reveal, Text, VisuallyHidden, cn } from 'citrine'
import { brand } from '../../brand'
import { Eyebrow } from '../../components/Eyebrow'

/**
 * The landing page's own vocabulary: one section shell, one eyebrow, one quiet
 * link, one install command. Every section is built from these, so the page
 * keeps a single rhythm — the same gutters, the same heading scale, the same
 * gap between a heading and what it introduces.
 */

export const kb = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 10240 ? 2 : 1)} kB`

/** The quiet "more of this" link, used under tiles and beside section headings. */
export function SectionLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'group inline-flex items-center gap-1 self-start rounded-md px-0.5 text-[12.5px] font-bold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
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
 * One section: eyebrow, heading, a short lede, an optional link set against
 * the heading on wide screens, then the content. `band` gives it a sunken
 * full-width ground, which is how the page alternates without resorting to
 * gradients.
 */
export function LandingSection({
  id,
  eyebrow,
  title,
  lede,
  action,
  band = false,
  children,
}: {
  /** The anchor, and the base of the heading's id. */
  id: string
  eyebrow: string
  title: ReactNode
  lede?: ReactNode
  action?: ReactNode
  band?: boolean
  children: ReactNode
}) {
  const titleId = `${id}-title`
  return (
    <section id={id} aria-labelledby={titleId} className={cn('scroll-mt-20', band && 'border-y border-line bg-surface-sunken')}>
      <div className="mx-auto w-full max-w-[1400px] px-5 py-16 sm:py-20 lg:px-8 lg:py-24">
        <Reveal>
          <header className="mb-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-4 lg:mb-12">
            <div className="flex max-w-[66ch] flex-col gap-3">
              <Eyebrow>{eyebrow}</Eyebrow>
              <Text as="h2" id={titleId} size="title" className="max-w-[24ch] text-balance leading-[1.08] sm:text-[36px]">
                {title}
              </Text>
              {lede && (
                <Text size="body" weight="medium" tone="soft" leading="normal" className="text-balance sm:text-[15px]">
                  {lede}
                </Text>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </header>
        </Reveal>
        {children}
      </div>
    </section>
  )
}

/** `$ npm i citrine`, copyable, with the result announced. */
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
        'group inline-flex h-10 items-center justify-between gap-4 rounded-full border border-line bg-surface px-4 font-mono text-[12px] font-semibold text-ink-soft transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        className,
      )}
    >
      <span>
        <span className="text-ink-faint">$</span> {command}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint group-hover:text-ink">
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
