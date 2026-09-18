'use client'

import { useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Spinner } from '../Spinner'
import { VisuallyHidden } from '../VisuallyHidden'

export type SocialLoginButtonsProvider = 'google' | 'github' | 'microsoft' | 'apple' | 'gitlab' | 'slack'
export type SocialLoginButtonsLayout = 'stack' | 'row'

export interface SocialLoginButtonsProps {
  /** Which providers to offer, in order. */
  providers?: SocialLoginButtonsProvider[]
  /** stack is full-width labelled buttons; row is a line of square marks that keep their names for assistive tech. */
  layout?: SocialLoginButtonsLayout
  /** Start sign-in. Return a promise to show that provider as pending until it settles. */
  onSelect?: (provider: SocialLoginButtonsProvider) => void | Promise<void>
  /** Called with the reason when `onSelect` rejects. */
  onError?: (provider: SocialLoginButtonsProvider, reason: unknown) => void
  /** Controlled pending provider — for redirects that never resolve a promise. */
  loadingProvider?: SocialLoginButtonsProvider | null
  /** The provider this browser used last time. It gets a quiet hint. */
  lastUsed?: SocialLoginButtonsProvider | null
  /** The words before the provider name. */
  verb?: string
  /** Blocks every button. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const mark = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true" className="shrink-0">
    {path}
  </svg>
)

const PROVIDERS: Record<SocialLoginButtonsProvider, { name: string; icon: ReactNode }> = {
  google: {
    name: 'Google',
    icon: mark(
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.19-1.79 4.13-1.15 1.15-2.93 2.4-6.05 2.4-4.83 0-8.6-3.89-8.6-8.72s3.77-8.72 8.6-8.72c2.6 0 4.51 1.03 5.91 2.35l2.31-2.31C18.75 1.44 16.13 0 12.48 0 5.87 0 .31 5.39.31 12s5.56 12 12.17 12c3.57 0 6.27-1.17 8.37-3.36 2.16-2.16 2.84-5.21 2.84-7.67 0-.76-.05-1.47-.17-2.05z" />,
    ),
  },
  github: {
    name: 'GitHub',
    icon: mark(
      <path d="M12 .3a12 12 0 00-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 016 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 011.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0012 .3" />,
    ),
  },
  microsoft: {
    name: 'Microsoft',
    icon: mark(<path d="M1.5 1.5h10v10h-10zM12.5 1.5h10v10h-10zM1.5 12.5h10v10h-10zM12.5 12.5h10v10h-10z" />),
  },
  apple: {
    name: 'Apple',
    icon: mark(
      <path d="M16.37 1.43c0 1.14-.42 2.2-1.1 2.98-.82.94-2.14 1.66-3.2 1.57-.13-1.1.42-2.25 1.08-2.98.74-.83 2.04-1.5 3.22-1.57zM20.5 17.1c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.05-1.77-4.04-3.33C-.07 15.9-.36 10.8 1.4 8.1 2.65 6.18 4.62 5.06 6.47 5.06c1.89 0 3.07 1.04 4.63 1.04 1.51 0 2.43-1.04 4.61-1.04 1.65 0 3.39.9 4.63 2.45-4.07 2.23-3.41 8.04.16 9.59z" />,
    ),
  },
  gitlab: {
    name: 'GitLab',
    icon: mark(
      <path d="M23.6 9.6l-.03-.09-3.26-8.5a.85.85 0 00-1.62.08l-2.2 6.74H7.5L5.3 1.09a.85.85 0 00-1.62-.08L.43 9.5l-.03.09a6.05 6.05 0 002 7l.04.03 4.97 3.72 2.46 1.86 1.5 1.13a1 1 0 001.22 0l1.5-1.13 2.46-1.86 5-3.75a6.06 6.06 0 002.05-6.99z" />,
    ),
  },
  slack: {
    name: 'Slack',
    icon: mark(
      <path d="M5.04 15.17a2.53 2.53 0 11-2.52-2.52h2.52zM6.31 15.17a2.53 2.53 0 015.04 0v6.31a2.53 2.53 0 11-5.04 0zM8.83 5.04a2.53 2.53 0 112.52-2.52v2.52zM8.83 6.31a2.53 2.53 0 010 5.04H2.52a2.53 2.53 0 010-5.04zM18.96 8.83a2.53 2.53 0 112.52 2.52h-2.52zM17.69 8.83a2.53 2.53 0 01-5.05 0V2.52a2.53 2.53 0 015.05 0zM15.17 18.96a2.53 2.53 0 11-2.52 2.52v-2.52zM15.17 17.69a2.53 2.53 0 010-5.05h6.31a2.53 2.53 0 010 5.05z" />,
    ),
  },
}

/**
 * "Continue with" buttons that look like one set, not six logos.
 *
 * Brand colours side by side turn a sign-in card into a row of adverts and
 * put the product’s own accent last in line. Every mark here is drawn in the
 * text colour on the same outline button, so the providers read as equal
 * options and the page keeps its palette. Each button says the whole thing —
 * "Continue with GitHub" — and the icon row keeps that as the accessible name
 * and tooltip, since a bare mark is not a label.
 *
 * Pressing one shows a spinner on that button and holds the others, so a
 * slow OAuth redirect cannot be started twice with two providers. The provider
 * used last time on this device gets a small hint, which is the single most
 * effective answer to "which one did I sign up with?".
 */
export function SocialLoginButtons({
  providers = ['google', 'github', 'microsoft', 'apple'],
  layout = 'stack',
  onSelect,
  onError,
  loadingProvider,
  lastUsed,
  verb = 'Continue with',
  disabled = false,
  className,
}: SocialLoginButtonsProps) {
  const [ownPending, setOwnPending] = useState<SocialLoginButtonsProvider | null>(null)
  const pending = loadingProvider ?? ownPending
  const hintId = useId()
  const row = layout === 'row'

  const select = async (provider: SocialLoginButtonsProvider) => {
    if (pending) return
    const result = onSelect?.(provider)
    if (!result || typeof (result as Promise<void>).then !== 'function') return
    setOwnPending(provider)
    try {
      await result
    } catch (reason) {
      onError?.(provider, reason)
    } finally {
      setOwnPending(null)
    }
  }

  return (
    <div role="group" aria-label="Sign-in options" className={cn(row ? 'flex flex-wrap gap-2' : 'flex w-full flex-col gap-2', className)}>
      {providers.map((provider) => {
        const { name, icon } = PROVIDERS[provider]
        const busy = pending === provider
        const last = lastUsed === provider
        const text = `${verb} ${name}`
        return (
          <button
            key={provider}
            type="button"
            aria-label={row ? text : undefined}
            title={row ? text : undefined}
            aria-describedby={last ? hintId : undefined}
            aria-busy={busy || undefined}
            disabled={disabled || (pending !== null && pending !== undefined && !busy)}
            onClick={() => void select(provider)}
            className={cn(
              'relative inline-flex items-center justify-center gap-2.5 rounded-full border border-line-strong bg-surface font-semibold text-ink transition-colors',
              'hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40',
              busy && 'pointer-events-none',
              row ? 'size-11' : 'h-10 w-full px-5 text-[13px]',
            )}
          >
            {busy ? <Spinner size="sm" /> : icon}
            {!row && <span>{text}</span>}
            {last && !row && (
              <span aria-hidden="true" className="rounded-full bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] px-2 py-0.5 text-[10px] font-bold text-ink-soft">
                Last used
              </span>
            )}
            {last && row && <span aria-hidden="true" className="absolute right-0.5 top-0.5 size-2.5 rounded-full border-2 border-surface bg-accent" />}
          </button>
        )
      })}
      {lastUsed && providers.includes(lastUsed) && (
        <VisuallyHidden>
          <span id={hintId}>You used this last time</span>
        </VisuallyHidden>
      )}
    </div>
  )
}
