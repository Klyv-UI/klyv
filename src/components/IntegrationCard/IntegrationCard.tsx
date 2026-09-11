'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { Spinner } from '../Spinner'
import { Surface } from '../Surface'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { LockIcon } from '../internal/icons'
import { StatusPill } from '../internal/StatusPill'

export type IntegrationStatus = 'available' | 'connected' | 'error' | 'pending'

export interface IntegrationCardProps {
  name: string
  description: ReactNode
  /** The service's mark. Application-owned. */
  logo: ReactNode
  category?: string
  status?: IntegrationStatus
  /** "Synced 4 minutes ago", or what went wrong. */
  meta?: ReactNode
  /** Qualifier beside the name — "Popular", "Beta". */
  badge?: string
  /** The plan it needs, when the account is not on it. Replaces Connect. */
  requiresPlan?: string
  onConnect?: () => void
  onDisconnect?: () => void
  onConfigure?: () => void
  onUpgrade?: () => void
  headingLevel?: 'h2' | 'h3'
  className?: string
}

/**
 * One integration in a marketplace grid: what it is, whether it is connected,
 * and the single next step.
 *
 * Exactly one primary action per state — Connect, Configure, Reconnect, or
 * Upgrade — so a grid of forty reads as forty clear choices. A broken
 * connection is shown as broken, with the reason, on the card itself; it is
 * the state that silently stops data flowing, and burying it in a settings
 * page is how nobody notices for a month.
 */
export function IntegrationCard({
  name,
  description,
  logo,
  category,
  status = 'available',
  meta,
  badge,
  requiresPlan,
  onConnect,
  onDisconnect,
  onConfigure,
  onUpgrade,
  headingLevel: Heading = 'h3',
  className,
}: IntegrationCardProps) {
  const pill =
    status === 'connected' ? (
      <StatusPill tone="success">Connected</StatusPill>
    ) : status === 'error' ? (
      <StatusPill tone="danger">Needs attention</StatusPill>
    ) : status === 'pending' ? (
      <StatusPill tone="warning">Connecting</StatusPill>
    ) : null

  return (
    <Surface variant="card" padding="lg" interactive className={cn('h-full gap-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-glyph)] border border-line bg-surface [&_img]:size-7 [&_svg]:size-6"
        >
          {logo}
        </span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {badge && <Badge tone="neutral">{badge}</Badge>}
          {pill}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col gap-1">
          <Heading className="text-[15px] font-bold leading-tight tracking-[-0.01em] text-ink">{name}</Heading>
          {category && (
            <Text size="caption" weight="semibold" tone="faint">
              {category}
            </Text>
          )}
        </div>
        <Text size="caption" weight="medium" tone="soft" leading="normal" className="line-clamp-3">
          {description}
        </Text>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <Text size="caption" weight="semibold" tone={status === 'error' ? 'danger' : 'faint'} className="min-w-0 flex-1">
          {meta}
        </Text>
        <div className="flex items-center gap-1">
          {status === 'pending' && <Spinner size="sm" label={`Connecting ${name}`} />}

          {status === 'available' &&
            (requiresPlan ? (
              <>
                <Tag size="sm">
                  <LockIcon size={10} />
                  {requiresPlan}
                </Tag>
                {onUpgrade && (
                  <Button size="sm" variant="ghost" onClick={onUpgrade}>
                    Upgrade
                  </Button>
                )}
              </>
            ) : (
              onConnect && (
                <Button size="sm" variant="outline" onClick={onConnect}>
                  Connect
                  <VisuallyHidden> {name}</VisuallyHidden>
                </Button>
              )
            ))}

          {status === 'connected' && (
            <>
              {onDisconnect && (
                <Button size="sm" variant="ghost" onClick={onDisconnect} className="hover:text-danger">
                  Disconnect
                </Button>
              )}
              {onConfigure && (
                <Button size="sm" variant="outline" onClick={onConfigure}>
                  Configure
                  <VisuallyHidden> {name}</VisuallyHidden>
                </Button>
              )}
            </>
          )}

          {status === 'error' && onConnect && (
            <Button size="sm" onClick={onConnect}>
              Reconnect
              <VisuallyHidden> {name}</VisuallyHidden>
            </Button>
          )}
        </div>
      </div>
    </Surface>
  )
}
