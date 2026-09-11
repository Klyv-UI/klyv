import type { ReactNode } from 'react'
import { EmptyState, type EmptyStateProps } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import type { IconComponent } from '../../lib/types'

export type ViewStatus = 'idle' | 'loading' | 'error' | 'empty' | 'ready'

export interface StateViewProps<T> {
  /** The data. Deciding empty from this is the point — see `status`. */
  data: T[] | undefined
  /** Explicit status. Omit and it is derived: undefined is loading, [] is empty. */
  status?: ViewStatus
  /** Rendered once there is data. */
  children: (data: T[]) => ReactNode
  /** Placeholder while loading. Match the shape of the real content. */
  skeleton?: ReactNode
  /** Copy for the empty case. */
  empty?: Pick<EmptyStateProps, 'icon' | 'title' | 'description' | 'action'>
  /** Copy for the failure case. */
  error?: { title?: string; description?: string; detail?: string }
  /** Retry affordance for the failure case. */
  onRetry?: ReactNode
  /** Glyph for the no-data case. */
  emptyIcon?: IconComponent
  /** Merged last, so it wins. */
  className?: string
}

/**
 * One component for the four states every data region has: loading, error,
 * empty and ready.
 *
 * Every list in an application repeats the same branch, and the branch is
 * almost always incomplete — the empty case gets skipped, or the error case
 * renders an empty list. Making it one component means the four states are
 * decided once, and adding a new region cannot forget one.
 *
 * Status is derived by default (undefined is loading, an empty array is empty),
 * so the common case needs no status prop at all.
 */
export function StateView<T>({
  data,
  status,
  children,
  skeleton,
  empty,
  error,
  onRetry,
  emptyIcon,
  className,
}: StateViewProps<T>) {
  const resolved: ViewStatus =
    status ?? (data === undefined ? 'loading' : data.length === 0 ? 'empty' : 'ready')

  if (resolved === 'loading' || resolved === 'idle') {
    return (
      <div className={className} aria-busy="true">
        {skeleton ?? <EmptyState title="Loading" size="sm" />}
      </div>
    )
  }

  if (resolved === 'error') {
    return (
      <div className={className}>
        <ErrorState
          title={error?.title}
          description={error?.description}
          detail={error?.detail}
          action={onRetry}
        />
      </div>
    )
  }

  if (resolved === 'empty') {
    return (
      <div className={className}>
        <EmptyState
          icon={empty?.icon ?? emptyIcon}
          title={empty?.title ?? 'Nothing here yet'}
          description={empty?.description}
          action={empty?.action}
        />
      </div>
    )
  }

  return <div className={className}>{children(data ?? [])}</div>
}
