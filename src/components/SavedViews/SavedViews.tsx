'use client'

import { useId, useState, type FormEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Input } from '../Input'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { ConfirmDialog } from '../ConfirmDialog'
import { LockIcon } from '../internal/icons'

export interface SavedView {
  id: string
  name: string
  /** Rows the view currently matches. */
  count?: number
  /** Visible to the whole workspace. */
  shared?: boolean
  /** Built in — cannot be overwritten or deleted. */
  locked?: boolean
}

export interface SavedViewsProps {
  views: SavedView[]
  value: string
  onValueChange: (id: string) => void
  /** The filters, sort or columns have changed since the view was loaded. */
  dirty?: boolean
  /** Overwrite the current view. */
  onSave?: () => void
  onSaveAs?: (name: string) => void
  onDiscard?: () => void
  onDelete?: (view: SavedView) => void
  label?: string
  className?: string
}

/**
 * Named combinations of filters, sort and columns — "My open deals", "Churn
 * risk" — as a row above a table.
 *
 * The part usually missing is the unsaved state. Change a filter on a saved
 * view and the table no longer shows what the view's name says; this says so,
 * next to the three honest choices — save over it, save as a new view, or put
 * it back. Built-in views cannot be saved over, only copied.
 */
export function SavedViews({
  views,
  value,
  onValueChange,
  dirty = false,
  onSave,
  onSaveAs,
  onDiscard,
  onDelete,
  label = 'Saved views',
  className,
}: SavedViewsProps) {
  const nameId = useId()
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [pending, setPending] = useState<SavedView | null>(null)

  const current = views.find((view) => view.id === value)

  const saveAs = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !onSaveAs) return
    onSaveAs(name.trim())
    setName('')
    setNaming(false)
  }

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1 py-0.5">
        <ul aria-label={label} className="flex w-max items-center gap-1.5">
          {views.map((view) => {
            const active = view.id === value
            return (
              <li key={view.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onValueChange(view.id)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors',
                    active
                      ? 'border-accent-strong bg-accent text-accent-ink'
                      : 'border-line-strong bg-surface text-ink-soft hover:text-ink',
                  )}
                >
                  {view.locked && <LockIcon size={10} />}
                  {view.name}
                  {active && dirty && (
                    <>
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                      <VisuallyHidden>, modified</VisuallyHidden>
                    </>
                  )}
                  {view.count !== undefined && (
                    <span className={cn('tabular text-[11px]', active ? 'text-accent-ink/70' : 'text-ink-faint')}>
                      {view.count.toLocaleString()}
                    </span>
                  )}
                  {view.shared && <VisuallyHidden>, shared with the workspace</VisuallyHidden>}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {(dirty || naming) && current && (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-tile)] bg-surface-sunken px-3 py-2">
          {naming ? (
            <form onSubmit={saveAs} className="flex flex-1 flex-wrap items-center gap-2">
              <label htmlFor={nameId} className="text-[12px] font-semibold text-ink-soft">
                New view name
              </label>
              <Input id={nameId} inputSize="sm" value={name} onChange={(event) => setName(event.target.value)} autoFocus containerClassName="min-w-[160px] flex-1" />
              <Button type="submit" size="sm" disabled={!name.trim()}>
                Save view
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNaming(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <>
              <Text as="span" size="caption" weight="semibold" tone="soft" role="status" className="flex-1">
                Unsaved changes to “{current.name}”
              </Text>
              {onDiscard && (
                <Button size="sm" variant="ghost" onClick={onDiscard}>
                  Discard
                </Button>
              )}
              {onSaveAs && (
                <Button size="sm" variant="outline" onClick={() => setNaming(true)}>
                  Save as new
                </Button>
              )}
              {onSave && !current.locked && (
                <Button size="sm" onClick={onSave}>
                  Save view
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {onDelete && current && !current.locked && !dirty && !naming && (
        <button
          type="button"
          onClick={() => setPending(current)}
          className="self-start rounded-full text-[11px] font-bold text-ink-faint underline underline-offset-2 hover:text-danger"
        >
          Delete “{current.name}”
        </button>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) onDelete?.(pending)
          setPending(null)
        }}
        destructive
        title={`Delete “${pending?.name ?? ''}”?`}
        description={pending?.shared ? 'It is shared, so it disappears for everyone in the workspace.' : 'The rows stay; only the saved view is removed.'}
        confirmLabel="Delete view"
      />
    </div>
  )
}
