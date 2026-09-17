'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Popover, type PopoverAlign, type PopoverPlacement } from '../Popover'
import { Text } from '../Text'

export type ConfirmPopoverTone = 'default' | 'destructive'

export interface ConfirmPopoverProps {
  /** The control that asks for confirmation — usually a Button or IconButton. */
  trigger: ReactNode
  /** The question — "Delete this file?". Also the panel’s accessible name. */
  title: string
  /** What happens, and whether it can be undone. */
  description?: ReactNode
  /** Label on the confirming button. */
  confirmLabel?: string
  /** Label on the cancelling button. */
  cancelLabel?: string
  /** destructive reddens the confirm button. */
  tone?: ConfirmPopoverTone
  /** Runs on confirm. Return a promise to hold the panel open, pending, until it settles; a rejection keeps it open with the message. */
  onConfirm: () => void | Promise<void>
  /** Called when the panel is dismissed without confirming. */
  onCancel?: () => void
  /** Controlled open state. */
  open?: boolean
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean
  /** Called when the panel opens or closes. */
  onOpenChange?: (open: boolean) => void
  placement?: PopoverPlacement
  align?: PopoverAlign
  /** Merged onto the panel. */
  className?: string
}

/**
 * A small "are you sure?" that stays next to the thing being confirmed.
 *
 * For a row-level delete a full modal is out of proportion: it darkens the
 * page and moves the reader’s eyes away from the row in question. This anchors
 * the question to the trigger instead, and keeps the safety of the modal where
 * it matters — focus lands on Cancel, so a stray Enter does nothing
 * destructive, Escape and an outside click back out, and focus returns to the
 * trigger on close.
 *
 * When `onConfirm` is async the confirm button shows it is working and the
 * panel will not dismiss until the work settles, so the reader is never left
 * wondering whether the delete went through. A failure keeps the panel open
 * and says why.
 */
export function ConfirmPopover({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom',
  align = 'start',
  className,
}: ConfirmPopoverProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = controlledOpen ?? uncontrolled

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolled(next)
    if (next) setError(null)
    onOpenChange?.(next)
  }

  const dismiss = () => {
    if (pending) return
    setOpen(false)
    onCancel?.()
  }

  const confirm = async () => {
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      setPending(false)
      setOpen(false)
    } catch (reason) {
      setPending(false)
      setError(reason instanceof Error ? reason.message : 'That did not work. Try again.')
    }
  }

  return (
    <Popover
      trigger={trigger}
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : dismiss())}
      dismissOnOutsideClick={!pending}
      placement={placement}
      align={align}
      label={title}
      initialFocus="[data-confirm-cancel]"
      className={cn('w-[280px] gap-3 p-4', className)}
    >
      <div className="flex flex-col gap-1.5">
        <Text size="body" weight="bold">
          {title}
        </Text>
        {description && (
          <Text size="label" tone="soft" leading="normal">
            {description}
          </Text>
        )}
      </div>
      {error && (
        <Text size="caption" tone="danger" weight="semibold" role="alert">
          {error}
        </Text>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" data-confirm-cancel="" disabled={pending} onClick={dismiss}>
          {cancelLabel}
        </Button>
        <Button
          size="sm"
          loading={pending}
          onClick={confirm}
          className={tone === 'destructive' ? 'bg-danger text-white hover:bg-danger/90' : undefined}
        >
          {confirmLabel}
        </Button>
      </div>
    </Popover>
  )
}
