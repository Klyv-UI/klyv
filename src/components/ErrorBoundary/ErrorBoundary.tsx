'use client'

import { Component, createRef, type ErrorInfo, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Text } from '../Text'

export interface ErrorBoundaryFallbackProps {
  /** What was thrown. Non-Error values are wrapped so there is always a message. */
  error: Error
  /** Clear the error and render the children again. */
  reset: () => void
}

export type ErrorBoundaryResetReason = 'retry' | 'keys'

export interface ErrorBoundaryProps {
  /** The subtree to protect. */
  children: ReactNode
  /**
   * What to show instead of a failed subtree: a node, or a function that gets the
   * error and a `reset`. Omit for the built-in panel with a retry button.
   */
  fallback?: ReactNode | ((props: ErrorBoundaryFallbackProps) => ReactNode)
  /**
   * Values the subtree depends on. When any of them changes while the fallback is
   * showing, the boundary resets itself — pick another record and the error goes.
   */
  resetKeys?: unknown[]
  /** Called once per caught error, with React’s component stack. Report it from here. */
  onError?: (error: Error, info: ErrorInfo) => void
  /** Called after the boundary clears its error, with what caused it. */
  onReset?: (reason: ErrorBoundaryResetReason) => void
  /** Heading of the built-in fallback. */
  title?: string
  /** Label of the built-in fallback’s retry button. */
  retryLabel?: string
  /** Merged onto the built-in fallback. */
  className?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

const toError = (value: unknown) =>
  value instanceof Error ? value : new Error(typeof value === 'string' ? value : 'Something went wrong.')

const keysChanged = (a: unknown[] = [], b: unknown[] = []) =>
  a.length !== b.length || a.some((value, index) => !Object.is(value, b[index]))

/**
 * Keeps one broken widget from taking the page down with it.
 *
 * React unmounts the whole tree when a render throws and nothing catches it, so
 * a bad row in a side panel blanks the checkout next to it. This catches the
 * throw at the edge of the subtree, shows a fallback in its place, and offers
 * the two ways out that actually work: retry (render again, for transient
 * failures) and `resetKeys` (reset when the input that caused it changes, so
 * moving to another record clears the error without a click).
 *
 * Keys are compared only while the error was already showing, so a key change
 * that itself causes the throw does not reset straight back into it. When the
 * fallback replaces the element that had focus, focus moves to the fallback
 * rather than dropping to the page body.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }
  private panel = createRef<HTMLDivElement>()

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError?.(toError(error), info)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState) {
    if (this.state.error && !prevState.error) {
      const active = document.activeElement
      if (!active || active === document.body) this.panel.current?.focus()
      return
    }
    if (this.state.error && prevState.error && keysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.reset('keys')
    }
  }

  reset = (reason: ErrorBoundaryResetReason = 'retry') => {
    this.setState({ error: null })
    this.props.onReset?.(reason)
  }

  private retry = () => this.reset('retry')

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const { fallback, title = 'This part didn’t load', retryLabel = 'Try again', className } = this.props
    if (typeof fallback === 'function') return fallback({ error, reset: this.retry })
    if (fallback !== undefined) return fallback

    return (
      <div
        ref={this.panel}
        role="alert"
        tabIndex={-1}
        className={cn(
          'flex flex-col items-start gap-2 rounded-[var(--radius-card)] border border-line p-4 outline-none',
          'bg-[color-mix(in_oklab,var(--color-danger)_6%,var(--color-surface))]',
          className,
        )}
      >
        <Text as="p" size="label" weight="bold">
          {title}
        </Text>
        <Text as="p" size="caption" tone="soft" leading="normal">
          {error.message}
        </Text>
        <Button size="sm" variant="outline" onClick={this.retry}>
          {retryLabel}
        </Button>
      </div>
    )
  }
}
