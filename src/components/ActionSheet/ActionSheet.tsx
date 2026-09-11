'use client'

import { cn } from '../../lib/cn'
import { Divider } from '../Divider'
import { Text } from '../Text'
import { Drawer } from '../Drawer'
import type { IconComponent } from '../../lib/types'

export interface ActionSheetAction {
  id: string
  label: string
  icon?: IconComponent
  description?: string
  destructive?: boolean
  disabled?: boolean
  onSelect: () => void
}

export interface ActionSheetProps {
  /** Whether the dialog is showing. */
  open: boolean
  /** Called on cancel, on Escape, and on a backdrop click. */
  onClose: () => void
  /** Visible title. */
  title: string
  /** What the sheet is about. */
  description?: string
  actions: ActionSheetAction[]
  /** Text on the trailing cancel row. */
  cancelLabel?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A bottom sheet of choices, for touch. The rows are deliberately tall and
 * full-width: this is the pattern used where a dropdown menu would be too small
 * to hit accurately with a thumb.
 *
 * It is a Drawer anchored to the bottom, so focus handling and dismissal are
 * the same as every other overlay.
 */
export function ActionSheet({
  open,
  onClose,
  title,
  description,
  actions,
  cancelLabel = 'Cancel',
  className,
}: ActionSheetProps) {
  return (
    <Drawer open={open} onClose={onClose} title={title} side="bottom" bare className={className}>
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-3 pb-2">
        <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-line-strong" />
        <div className="px-1">
          <Text as="h2" size="heading">
            {title}
          </Text>
          {description && (
            <Text size="caption" tone="faint" leading="normal" className="mt-1">
              {description}
            </Text>
          )}
        </div>

        <div className="flex flex-col">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                type="button"
                disabled={action.disabled}
                onClick={() => {
                  action.onSelect()
                  onClose()
                }}
                className={cn(
                  'flex items-center gap-3 rounded-[var(--radius-tile)] px-3 py-3.5 text-left transition-colors',
                  'disabled:pointer-events-none disabled:opacity-40',
                  action.destructive ? 'text-danger hover:bg-danger/10' : 'text-ink hover:bg-surface-muted',
                )}
              >
                {Icon && <Icon size={18} strokeWidth={2} aria-hidden="true" />}
                <span className="min-w-0 flex-1">
                  <Text as="span" size="body" className="block text-current">
                    {action.label}
                  </Text>
                  {action.description && (
                    <Text as="span" size="caption" tone="faint" className="block">
                      {action.description}
                    </Text>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <Divider />
        <button
          type="button"
          onClick={onClose}
          className="rounded-[var(--radius-tile)] px-3 py-3.5 text-[13px] font-bold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
        >
          {cancelLabel}
        </button>
      </div>
    </Drawer>
  )
}
