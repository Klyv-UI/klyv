'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Surface } from '../Surface'
import { Text } from '../Text'

export interface CookieBannerProps {
  onAcceptAll: () => void
  onRejectAll: () => void
  /** Open the full choice — usually a Modal holding ConsentManager. */
  onCustomize?: () => void
  title?: string
  children?: ReactNode
  policyHref?: string
  /** bottom centres a bar; bottom-start is a corner card; inline stays in the flow. */
  position?: 'bottom' | 'bottom-start' | 'inline'
  className?: string
}

const POSITIONS = {
  bottom: 'fixed inset-x-3 bottom-3 z-[var(--z-overlay)] mx-auto max-w-[720px]',
  'bottom-start': 'fixed bottom-3 left-3 right-3 z-[var(--z-overlay)] sm:right-auto sm:w-[400px]',
  inline: '',
} as const

/**
 * The first-visit consent prompt. `ConsentManager` is the full per-category
 * choice; this is the short question in front of it.
 *
 * Reject all is exactly as easy as Accept all — same size, same style, same
 * row, one click. A pale "reject" link under a bright "accept" button is the
 * pattern regulators name, and it is also the reason people stop trusting the
 * banner. It is a region, not a modal: it does not trap focus or block the
 * page, so it can be answered — or ignored — on the reader's terms.
 */
export function CookieBanner({
  onAcceptAll,
  onRejectAll,
  onCustomize,
  title = 'Cookies on this site',
  children = 'We use essential cookies to make the site work, and optional ones to understand how it is used. You choose which optional ones to allow.',
  policyHref,
  position = 'bottom',
  className,
}: CookieBannerProps) {
  const bar = position === 'bottom'

  return (
    <Surface
      role="region"
      aria-label="Cookie consent"
      variant="floating"
      padding="lg"
      className={cn(
        'gap-4 border border-line',
        bar && 'sm:flex-row sm:items-center sm:gap-6',
        POSITIONS[position],
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Text size="heading">{title}</Text>
        <Text size="caption" weight="medium" tone="soft" leading="normal">
          {children}
          {policyHref && (
            <>
              {' '}
              <a href={policyHref} className="font-bold text-ink underline underline-offset-2">
                Cookie policy
              </a>
            </>
          )}
        </Text>
      </div>
      <div className={cn('flex flex-wrap gap-2', bar ? 'sm:shrink-0' : '')}>
        {onCustomize && (
          <Button size="sm" variant="ghost" onClick={onCustomize}>
            Customise
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onRejectAll} className="flex-1 sm:flex-none">
          Reject all
        </Button>
        <Button size="sm" variant="outline" onClick={onAcceptAll} className="flex-1 sm:flex-none">
          Accept all
        </Button>
      </div>
    </Surface>
  )
}
