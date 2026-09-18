'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { Text } from '../Text'
import { CrossIcon } from '../internal/icons'

export type UpdateAvailableVariant = 'toast' | 'banner'

export interface UpdateAvailableProps {
  /** Whether a new version is waiting. Set it when the service worker or version check reports one. */
  available: boolean
  /** Reloads onto the new version — usually `registration.waiting.postMessage` then `location.reload()`. */
  onReload: () => void
  /** The waiting version, shown after the title. A new version string brings a dismissed prompt back. */
  version?: string
  /** Headline. */
  title?: string
  /** One line on why reloading is worth it. */
  description?: ReactNode
  /** Where the release notes live. */
  whatsNewHref?: string
  /** Label on the release notes link. */
  whatsNewLabel?: string
  /** Label on the reload button. */
  reloadLabel?: string
  /** Called when the reader chooses to finish what they are doing first. */
  onLater?: () => void
  /** Minutes a snooze hides the prompt for. Pass 0 to leave the snooze out. */
  snoozeMinutes?: number
  /** Called with the moment the snoozed prompt will return. */
  onSnooze?: (until: Date) => void
  /** Shows the reload as in progress — the new worker is activating. */
  reloading?: boolean
  /** toast floats as a card; banner is a full-width strip. */
  variant?: UpdateAvailableVariant
  /** Pin to the viewport — bottom corner for a toast, top edge for a banner — instead of sitting in the flow. */
  fixed?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The "a new version is available" prompt for an app that stays open for days.
 *
 * Reloading for the reader is the tempting shortcut, and it throws away a
 * half-written form. So the prompt asks, and never blocks: it is not a dialog,
 * it takes no focus, and it is announced politely rather than as an alert,
 * because nothing is wrong — the page they have still works.
 *
 * "Later" hides it until the version changes; snooze hides it for a set time
 * and brings it back by itself, which is what people usually mean by later.
 */
export function UpdateAvailable({
  available,
  onReload,
  version,
  title = 'A new version is available',
  description = 'Reload to get the latest fixes. Anything you have not saved on this page will be lost.',
  whatsNewHref,
  whatsNewLabel = 'What’s new',
  reloadLabel = 'Reload now',
  onLater,
  snoozeMinutes = 60,
  onSnooze,
  reloading = false,
  variant = 'toast',
  fixed = false,
  className,
}: UpdateAvailableProps) {
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null)
  const timer = useRef<number | undefined>(undefined)

  // A later version replaces the one that was put off, so the prompt returns.
  useEffect(() => {
    setDismissedVersion((current) => (current !== null && current !== (version ?? '') ? null : current))
  }, [version])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const visible = available && dismissedVersion === null && snoozedUntil === null

  const later = () => {
    setDismissedVersion(version ?? '')
    onLater?.()
  }

  const snooze = () => {
    const until = Date.now() + snoozeMinutes * 60_000
    setSnoozedUntil(until)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSnoozedUntil(null), snoozeMinutes * 60_000)
    onSnooze?.(new Date(until))
  }

  const snoozeText = snoozeMinutes >= 60 && snoozeMinutes % 60 === 0
    ? `${snoozeMinutes / 60} ${snoozeMinutes === 60 ? 'hour' : 'hours'}`
    : `${snoozeMinutes} min`

  const banner = variant === 'banner'

  return (
    <>
      {/* Mounted before the prompt appears, so the arrival is actually read out. */}
      <span role="status" aria-live="polite" className="sr-only">
        {visible ? `${title}${version ? `: ${version}` : ''}` : ''}
      </span>
      {visible && (
        <div
          className={cn(
            'flex border border-line bg-surface text-ink',
            banner
              ? 'flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5'
              : 'w-full max-w-[380px] flex-col gap-3 rounded-[var(--radius-tile)] p-4 shadow-[var(--shadow-float)]',
            banner && (fixed ? 'fixed inset-x-0 top-0 z-[var(--z-toast)] border-x-0 border-t-0' : 'rounded-[var(--radius-tile)]'),
            !banner && fixed && 'fixed bottom-4 right-4 z-[var(--z-toast)] w-[calc(100vw-2rem)]',
            className,
          )}
        >
          <div className={cn('flex min-w-0 gap-3', banner ? 'flex-1 items-center' : 'items-start')}>
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex size-2.5 shrink-0 rounded-full bg-accent-strong ring-4 ring-[color-mix(in_oklab,var(--color-accent)_30%,transparent)]"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Text size="body" weight="bold">
                {title}
                {version && (
                  <Text as="span" size="label" tone="faint" className="ml-1.5 font-mono">
                    {version}
                  </Text>
                )}
              </Text>
              {description && (
                <Text size="label" tone="soft" leading="normal" className={banner ? 'hidden sm:block' : undefined}>
                  {description}
                </Text>
              )}
            </div>
            {!banner && (
              <IconButton icon={CrossIcon} label="Remind me later" size="xs" onClick={later} className="-mr-1.5 -mt-1.5" />
            )}
          </div>

          <div className={cn('flex flex-wrap items-center gap-2', !banner && 'pl-[22px]')}>
            <Button size="sm" loading={reloading} onClick={onReload}>
              {reloadLabel}
            </Button>
            {snoozeMinutes > 0 && (
              <Button size="sm" variant="ghost" onClick={snooze}>
                Snooze {snoozeText}
              </Button>
            )}
            {banner && (
              <Button size="sm" variant="ghost" onClick={later}>
                Later
              </Button>
            )}
            {whatsNewHref && (
              <a
                href={whatsNewHref}
                className="ml-auto rounded-full px-1 text-[12px] font-bold text-ink underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {whatsNewLabel}
              </a>
            )}
          </div>
        </div>
      )}
    </>
  )
}
