import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { DISPLAY_LG } from '../internal/StatusPill'

export type CtaTone = 'accent' | 'ink' | 'muted'

const TONES: Record<CtaTone, { surface: string; body: string }> = {
  accent: { surface: 'bg-accent text-accent-ink', body: 'text-accent-ink' },
  ink: { surface: 'bg-ink text-ink-inverse', body: 'text-ink-inverse/70' },
  muted: { surface: 'bg-surface-muted text-ink', body: 'text-ink-soft' },
}

export interface CtaSectionProps {
  title: ReactNode
  description?: ReactNode
  /** Usually a white Button and a quieter secondary one. */
  actions?: ReactNode
  /** Reassurance under the actions. */
  note?: ReactNode
  /** Artwork or a product crop on the right, from lg. */
  aside?: ReactNode
  tone?: CtaTone
  headingLevel?: 'h2' | 'h3'
  className?: string
}

/**
 * The closing ask at the bottom of a page, and the one block on it allowed to
 * be loud. It carries the banner radius, so it reads as a sibling of the
 * dashboard's promo card rather than a new shape.
 *
 * The accent tone uses `accent-ink` for its text, which the theme derives from
 * the accent — so a deep brand colour gets white copy without a variant.
 */
export function CtaSection({
  title,
  description,
  actions,
  note,
  aside,
  tone = 'accent',
  headingLevel: Heading = 'h2',
  className,
}: CtaSectionProps) {
  const palette = TONES[tone]

  return (
    <section
      className={cn(
        'relative isolate overflow-hidden rounded-[var(--radius-banner)] px-6 py-12 sm:px-12 sm:py-14',
        palette.surface,
        className,
      )}
    >
      {/* Two rings, drawn in the text colour at low opacity so they follow the tone. */}
      <span
        aria-hidden="true"
        className="absolute -right-24 -top-24 -z-10 size-[340px] rounded-full border-[40px] border-current opacity-[0.06]"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-32 right-24 -z-10 size-[260px] rounded-full border-[28px] border-current opacity-[0.05]"
      />

      <div
        className={cn(
          'flex flex-col gap-8',
          aside ? 'lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center' : 'lg:flex-row lg:items-center lg:justify-between',
        )}
      >
        <div className="flex max-w-[52ch] flex-col gap-4">
          <Heading className={DISPLAY_LG}>{title}</Heading>
          {description && (
            <p className={cn('text-[15px] font-medium leading-normal', palette.body)}>{description}</p>
          )}
        </div>
        <div className="flex flex-col items-start gap-3">
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
          {note && <p className={cn('text-[11px] font-semibold', palette.body)}>{note}</p>}
        </div>
        {aside && <div className="hidden lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block">{aside}</div>}
      </div>
    </section>
  )
}
