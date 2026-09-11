import { cn } from '../../lib/cn'
import { Meter } from '../Meter'
import { StatusDot } from '../StatusDot'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface PasswordRule {
  label: string
  test: (value: string) => boolean
}

/** Length, a number, a symbol and mixed case — the checks most policies ask for. */
export const DEFAULT_PASSWORD_RULES: PasswordRule[] = [
  { label: '12 characters or more', test: (value) => value.length >= 12 },
  { label: 'a number', test: (value) => /\d/.test(value) },
  { label: 'a symbol', test: (value) => /[^A-Za-z0-9]/.test(value) },
  { label: 'upper and lower case', test: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
]

const DEFAULT_LEVELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']

export interface PasswordStrengthProps {
  /** The password, as it is being typed. */
  value: string
  /** The checks, each a label and a test. */
  rules?: PasswordRule[]
  /** One word per score, from no rules met to all of them: rules.length + 1 entries. */
  levels?: string[]
  /** Show only the meter and the level word, without the checklist. */
  compact?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * How strong a password is, and what would make it stronger.
 *
 * The score is a Meter, so it is a measurement with a value and a maximum — not
 * a coloured bar only sighted people can read. The level word is announced
 * politely, and it only changes when a rule flips, so it speaks on progress
 * rather than on every keystroke. Each rule says in words whether it is met;
 * the dot beside it is decoration.
 */
export function PasswordStrength({
  value,
  rules = DEFAULT_PASSWORD_RULES,
  levels = DEFAULT_LEVELS,
  compact = false,
  className,
}: PasswordStrengthProps) {
  const results = rules.map((rule) => ({ rule, met: rule.test(value) }))
  const score = results.filter((result) => result.met).length
  const level = levels[Math.min(score, levels.length - 1)] ?? ''
  const strong = score === rules.length

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-3">
        <Meter
          value={score}
          total={rules.length}
          label={`Password strength: ${level}`}
          className="flex-1"
        />
        <Text as="span" size="caption" weight="bold" tone={strong ? 'success' : 'soft'} aria-hidden="true">
          {level}
        </Text>
      </div>

      <VisuallyHidden>
        <span role="status" aria-live="polite">
          {value ? `Password strength: ${level}` : ''}
        </span>
      </VisuallyHidden>

      {!compact && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {results.map(({ rule, met }) => (
            <li key={rule.label} className="flex items-center gap-1.5">
              <StatusDot tone={met ? 'success' : 'neutral'} size="sm" />
              <Text as="span" size="micro" weight="semibold" tone={met ? 'default' : 'faint'}>
                {rule.label}
                <VisuallyHidden>{met ? ', met' : ', not met yet'}</VisuallyHidden>
              </Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
