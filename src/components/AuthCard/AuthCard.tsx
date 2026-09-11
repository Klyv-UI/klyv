'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Divider } from '../Divider'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { Alert } from '../Alert'

export interface AuthProvider {
  id: string
  /** The whole button text — "Continue with Google". */
  label: string
  /** The provider's mark. Application-owned; the library ships no logos. */
  icon?: ReactNode
  onClick: () => void
  loading?: boolean
}

export interface AuthCardProps {
  /** "Sign in to Acme", "Create your account". */
  title: string
  description?: ReactNode
  /** Lockup above the title. */
  brand?: ReactNode
  /** Single sign-on buttons, drawn above the form. */
  providers?: AuthProvider[]
  /** stack is one per row; grid puts two side by side from sm. */
  providerLayout?: 'stack' | 'grid'
  /** Word on the rule between providers and form. */
  dividerLabel?: string
  /** A failed attempt — announced, and kept until the next one. */
  error?: string
  /** The form itself: Fields, a PasswordInput, the submit Button. */
  children?: ReactNode
  /** Small print under the form — terms, privacy. */
  legal?: ReactNode
  /** The switch to the other flow — "No account? Sign up". */
  footer?: ReactNode
  headingLevel?: 'h1' | 'h2'
  className?: string
}

/**
 * The frame every authentication screen shares: sign in, sign up, reset,
 * verify, accept an invitation.
 *
 * It owns the layout and nothing about the fields, because those differ per
 * screen and per product and a library that guesses at them gets them wrong.
 * What it does fix is the order — providers, then the rule, then the form, then
 * the way out — and the error, which is announced as an alert at the top rather
 * than as red text under a field the person has already left.
 *
 * Its title is an `h1`: on a sign-in page the card is the page.
 */
export function AuthCard({
  title,
  description,
  brand,
  providers = [],
  providerLayout = 'stack',
  dividerLabel = 'or',
  error,
  children,
  legal,
  footer,
  headingLevel: Heading = 'h1',
  className,
}: AuthCardProps) {
  return (
    <Surface variant="card" className={cn('w-full max-w-[420px] overflow-hidden', className)}>
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          {brand}
          <Heading className="text-[22px] font-extrabold leading-tight tracking-[-0.025em] text-ink">
            {title}
          </Heading>
          {description && (
            <Text size="body" weight="medium" tone="soft" leading="normal">
              {description}
            </Text>
          )}
        </div>

        {error && (
          <Alert tone="danger" live>
            {error}
          </Alert>
        )}

        {providers.length > 0 && (
          <div className={cn('grid gap-2.5', providerLayout === 'grid' && 'sm:grid-cols-2')}>
            {providers.map((provider) => (
              <Button
                key={provider.id}
                variant="outline"
                fullWidth
                loading={provider.loading}
                onClick={provider.onClick}
              >
                {!provider.loading && provider.icon && (
                  <span aria-hidden="true" className="flex size-4 items-center [&_svg]:size-4">
                    {provider.icon}
                  </span>
                )}
                {provider.label}
              </Button>
            ))}
          </div>
        )}

        {providers.length > 0 && children && (
          <div className="flex items-center gap-3" role="separator" aria-label={dividerLabel}>
            <Divider className="flex-1" />
            <Text as="span" size="caption" weight="semibold" tone="faint" aria-hidden="true">
              {dividerLabel}
            </Text>
            <Divider className="flex-1" />
          </div>
        )}

        {children && <div className="flex flex-col gap-4">{children}</div>}

        {legal && (
          <Text size="caption" tone="faint" leading="normal" className="text-center">
            {legal}
          </Text>
        )}
      </div>

      {footer && (
        <div className="border-t border-line bg-surface-sunken px-6 py-4 text-center text-[12px] font-medium text-ink-soft">
          {footer}
        </div>
      )}
    </Surface>
  )
}
