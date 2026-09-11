'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Surface } from '../Surface'
import { Text } from '../Text'

export interface PermissionGateProps {
  /** Rendered only when the permission is held. */
  children: ReactNode
  /** Scopes the current person holds. */
  granted: string[]
  /** Scopes this region needs. */
  requires: string[]
  /** All of them, or any one. */
  mode?: 'all' | 'any'
  /** Readable names for scopes, used in the explanation. */
  names?: Record<string, string>
  /** What this region is, so the refusal can name it. */
  label?: string
  /** Replace the built-in explanation entirely. */
  fallback?: ReactNode
  /** Offer to ask for access. */
  onRequest?: () => void
  /**
   * Render nothing rather than an explanation. Correct only where the region's
   * existence is itself confidential — never merely to tidy the layout.
   */
  silent?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Shows a region only to people who may see it, and says so plainly when they
 * may not.
 *
 * The default is an explanation, not emptiness. A blank space where a panel
 * should be is read as a bug, and the support ticket it produces costs more
 * than the sentence would have — so the refusal names the region, names the
 * missing permission, and offers a way to ask for it.
 *
 * `silent` exists for the genuine exception, where even knowing the region
 * exists leaks something. It is opt-in precisely because it is the wrong answer
 * almost every time, and making it the default is how products end up full of
 * mysterious gaps.
 *
 * This is presentation, not enforcement. A scope check in the browser hides a
 * panel; it does not protect the data behind it, and the server has to make the
 * same decision independently.
 */
export function PermissionGate({
  children,
  granted,
  requires,
  mode = 'all',
  names,
  label,
  fallback,
  onRequest,
  silent = false,
  className,
}: PermissionGateProps) {
  const missing = requires.filter((scope) => !granted.includes(scope))
  const allowed = mode === 'all' ? missing.length === 0 : requires.some((scope) => granted.includes(scope))

  if (allowed) return <>{children}</>
  if (silent) return null
  if (fallback) return <>{fallback}</>

  const readable = (mode === 'all' ? missing : requires).map((scope) => names?.[scope] ?? scope)

  return (
    <Surface
      variant="card"
      padding="lg"
      role="note"
      className={cn('items-start gap-2', className)}
    >
      <Text size="heading">
        {label ? `You do not have access to ${label}` : 'You do not have access to this'}
      </Text>
      <Text size="body" weight="medium" tone="soft" leading="normal" className="max-w-[56ch]">
        {mode === 'all'
          ? `It needs ${readable.length === 1 ? 'the permission' : 'the permissions'} ${readable.join(', ')}, which your account does not have.`
          : `It needs one of ${readable.join(', ')}, and your account has none of them.`}
      </Text>
      {onRequest && (
        <Button size="sm" variant="outline" className="mt-1" onClick={onRequest}>
          Ask for access
        </Button>
      )}
    </Surface>
  )
}
