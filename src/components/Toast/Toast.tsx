'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { Text } from '../Text'
import { Portal } from '../Portal'
import { Presence } from '../Presence'
import { CrossIcon } from '../internal/icons'

export type ToastTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface ToastOptions {
  title: string
  description?: string
  tone?: ToastTone
  /** Milliseconds before it dismisses itself. Pass 0 to keep it until dismissed. */
  duration?: number
  /** A single affordance, such as Undo. */
  action?: { label: string; onSelect: () => void }
}

interface ToastEntry extends ToastOptions {
  id: number
}

const RAILS: Record<ToastTone, string> = {
  neutral: 'bg-ink-faint',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

interface ToastContextValue {
  toast: (options: ToastOptions) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/** Raises toasts from anywhere under a ToastProvider. */
export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside a ToastProvider')
  return value
}

export interface ToastProviderProps {
  children: ReactNode
  /** Oldest toasts are dropped once this many are on screen. */
  max?: number
  placement?: 'top-right' | 'bottom-right' | 'bottom-center'
}

const PLACEMENTS = {
  'top-right': 'top-4 right-4 items-end',
  'bottom-right': 'bottom-4 right-4 items-end',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
} as const

/**
 * Transient confirmations, queued and stacked.
 *
 * The region is a polite live region, so a toast is announced without stealing
 * focus. That is also why a toast must never be the only place an action lives:
 * it disappears, and anything reachable only by racing it is not reachable.
 */
export function ToastProvider({ children, max = 4, placement = 'bottom-right' }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((previous) => previous.filter((entry) => entry.id !== id))
  }, [])

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++
      setToasts((previous) => [...previous, { ...options, id }].slice(-max))
      return id
    },
    [max],
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Portal>
        <div
          role="region"
          aria-label="Notifications"
          className={cn(
            'pointer-events-none fixed z-[var(--z-toast)] flex w-[calc(100vw-32px)] max-w-[360px] flex-col gap-2',
            PLACEMENTS[placement],
          )}
        >
          {toasts.map((entry) => (
            <ToastItem key={entry.id} entry={entry} onDismiss={() => dismiss(entry.id)} />
          ))}
        </div>
      </Portal>
    </ToastContext.Provider>
  )
}

function ToastItem({ entry, onDismiss }: { entry: ToastEntry; onDismiss: () => void }) {
  const [present, setPresent] = useState(true)
  const duration = entry.duration ?? 5000

  useEffect(() => {
    if (duration <= 0) return
    const timer = setTimeout(() => setPresent(false), duration)
    return () => clearTimeout(timer)
  }, [duration])

  useEffect(() => {
    if (present) return
    const timer = setTimeout(onDismiss, 180)
    return () => clearTimeout(timer)
  }, [present, onDismiss])

  return (
    <Presence present={present} animation="slide-right" duration={180}>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface p-3.5 pl-4 shadow-[var(--shadow-float)]"
      >
        <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', RAILS[entry.tone ?? 'neutral'])} />
        <div className="min-w-0 flex-1">
          <Text size="body">{entry.title}</Text>
          {entry.description && (
            <Text size="caption" weight="medium" tone="faint" leading="normal" className="mt-0.5">
              {entry.description}
            </Text>
          )}
        </div>
        {entry.action && (
          <button
            type="button"
            onClick={() => {
              entry.action?.onSelect()
              setPresent(false)
            }}
            className="shrink-0 rounded-full px-2 py-1 text-[12px] font-bold text-ink transition-colors hover:bg-surface-muted"
          >
            {entry.action.label}
          </button>
        )}
        <IconButton icon={CrossIcon} label="Dismiss" size="xs" onClick={() => setPresent(false)} className="-mr-1 -mt-1 shrink-0" />
      </div>
    </Presence>
  )
}
