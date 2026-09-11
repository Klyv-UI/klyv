'use client'

import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { Switch } from '../Switch'

export interface ConsentCategory {
  id: string
  label: string
  description: string
  /** Always on, and honestly explained rather than silently forced. */
  required?: boolean
  /** Who receives the data. Naming them is most of what consent means. */
  recipients?: string[]
}

export interface ConsentManagerProps {
  categories: ConsentCategory[]
  /** Which categories are on. Required ones are treated as on regardless. */
  value: Record<string, boolean>
  onChange: (value: Record<string, boolean>) => void
  /** Save the current selection. */
  onSave: (value: Record<string, boolean>) => void
  /** Accessible name. */
  label: string
  /** Copy above the list. */
  description?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Granular consent, with rejecting everything exactly as easy as accepting it.
 *
 * The two bulk buttons are the same size, the same shape and side by side.
 * Every dark pattern in this space is built the other way — a bright Accept all
 * beside a grey link to a settings page — and a consent choice that is
 * cheaper to give than to withhold is not a choice, it is a toll.
 *
 * Required categories are shown, switched on and disabled, with the reason
 * beside them. Hiding them would be simpler and would also be the moment the
 * screen stops being an honest description of what happens.
 *
 * Recipients are named per category. "Analytics" is not informed consent;
 * "Analytics — shared with Fathom" is the same sentence with the part that
 * matters left in.
 */
export function ConsentManager({
  categories,
  value,
  onChange,
  onSave,
  label,
  description,
  className,
}: ConsentManagerProps) {
  const set = (next: Record<string, boolean>) => onChange(next)

  const all = (on: boolean) => {
    const next: Record<string, boolean> = {}
    for (const category of categories) next[category.id] = category.required ? true : on
    set(next)
    onSave(next)
  }

  const optional = categories.filter((category) => !category.required)
  const chosen = optional.filter((category) => value[category.id]).length

  return (
    <Surface
      variant="card"
      padding="lg"
      role="group"
      aria-label={label}
      className={cn('gap-4', className)}
    >
      {description && (
        <Text size="body" weight="medium" tone="soft" leading="normal">
          {description}
        </Text>
      )}

      <ul className="flex flex-col divide-y divide-line">
        {categories.map((category) => {
          const on = category.required || Boolean(value[category.id])
          return (
            <li key={category.id} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <Text as="span" size="body">
                  {category.label}
                </Text>
                <Text as="span" size="caption" tone="soft" leading="normal">
                  {category.description}
                </Text>
                {category.recipients && category.recipients.length > 0 && (
                  <Text as="span" size="caption" tone="faint">
                    Shared with {category.recipients.join(', ')}
                  </Text>
                )}
                {category.required && (
                  <Text as="span" size="caption" tone="faint">
                    Always on — the service does not work without it.
                  </Text>
                )}
              </span>

              <Switch
                checked={on}
                disabled={category.required}
                aria-label={category.label}
                onChange={(event) => set({ ...value, [category.id]: event.target.checked })}
              />
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        {/* Equal weight, side by side. Anything else is a toll, not a choice. */}
        <Button variant="outline" onClick={() => all(false)}>
          Reject all
        </Button>
        <Button variant="outline" onClick={() => all(true)}>
          Accept all
        </Button>
        <Button className="ml-auto" onClick={() => onSave(value)}>
          Save choices
        </Button>
      </div>

      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {chosen} of {optional.length} optional {optional.length === 1 ? 'category' : 'categories'} on.
      </Text>
    </Surface>
  )
}
