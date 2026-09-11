'use client'

import { useId, type FormEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Surface } from '../Surface'
import { Text } from '../Text'

export interface SettingsSectionProps {
  title: string
  description?: ReactNode
  /** Fields and SettingsRows. */
  children: ReactNode
  /** split puts the description beside the card from md; stacked puts it above. */
  layout?: 'split' | 'stacked'
  /** Adds a save bar and turns the card into a form. */
  onSave?: () => void | Promise<void>
  /** Put the fields back as they were. */
  onReset?: () => void
  /** Something has changed. Save and reset stay disabled until it has. */
  dirty?: boolean
  saving?: boolean
  saveLabel?: string
  /** Left side of the save bar while nothing has changed — "Last saved 2 min ago". */
  footerNote?: ReactNode
  headingLevel?: 'h2' | 'h3'
  id?: string
  className?: string
}

/**
 * One block of a settings page — Profile, Notifications, Security — with its
 * own save bar.
 *
 * Each section saves on its own. A single "Save" at the bottom of a long page
 * discards the edits in every other section the moment one fails validation,
 * and nobody scrolls back up to find out which.
 *
 * Save is disabled until something changes, and the bar says so when it has —
 * the only reliable way to stop someone navigating away from an edit they
 * thought had already been kept.
 */
export function SettingsSection({
  title,
  description,
  children,
  layout = 'split',
  onSave,
  onReset,
  dirty = false,
  saving = false,
  saveLabel = 'Save changes',
  footerNote,
  headingLevel: Heading = 'h2',
  id,
  className,
}: SettingsSectionProps) {
  const headingId = useId()
  const split = layout === 'split'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (dirty && !saving) void onSave?.()
  }

  const body = <div className="flex flex-col gap-5 p-5">{children}</div>

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn('grid gap-4', split && 'md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-8', className)}
    >
      <div className="flex flex-col gap-1.5">
        <Heading id={headingId} className="text-[15px] font-bold leading-tight tracking-[-0.01em] text-ink">
          {title}
        </Heading>
        {description && (
          <Text size="label" weight="medium" tone="soft" leading="normal" className="max-w-[48ch]">
            {description}
          </Text>
        )}
      </div>

      {onSave ? (
        <Surface as="form" variant="card" onSubmit={submit} noValidate>
          {body}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-[var(--radius-card)] border-t border-line bg-surface-sunken px-5 py-3">
            <Text size="caption" weight="semibold" tone={dirty ? 'default' : 'faint'} role="status" aria-live="polite">
              {dirty ? 'You have unsaved changes' : footerNote}
            </Text>
            <div className="ml-auto flex gap-2">
              {onReset && (
                <Button size="sm" variant="ghost" onClick={onReset} disabled={!dirty || saving}>
                  Discard
                </Button>
              )}
              <Button type="submit" size="sm" loading={saving} disabled={!dirty}>
                {saveLabel}
              </Button>
            </div>
          </div>
        </Surface>
      ) : (
        <Surface variant="card">{body}</Surface>
      )}
    </section>
  )
}

export interface SettingsRowProps {
  label: string
  description?: ReactNode
  /** The control's id, so the label is its accessible name. */
  htmlFor?: string
  /** The control — a Switch, a Select, a Button. */
  children: ReactNode
  className?: string
}

/**
 * A single setting laid out as a sentence and a control: "Weekly digest — a
 * summary every Monday" on the left, the switch on the right. Rows divide
 * themselves, so a section of them needs no extra markup.
 */
export function SettingsRow({ label, description, htmlFor, children, className }: SettingsRowProps) {
  const LabelTag = htmlFor ? 'label' : 'span'
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-line pb-5 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <LabelTag htmlFor={htmlFor} className="text-[13px] font-bold leading-tight text-ink">
          {label}
        </LabelTag>
        {description && (
          <Text size="caption" weight="medium" tone="soft" leading="normal">
            {description}
          </Text>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
