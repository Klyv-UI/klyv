'use client'

import { useState } from 'react'
import { Text } from '../Text'
import { Input } from '../Input'
import { AlertDialog } from '../AlertDialog'

export interface ConfirmDialogProps {
  /** Whether the dialog is showing. */
  open: boolean
  /** Called on cancel, on Escape, and on a backdrop click. */
  onClose: () => void
  /** Called when the confirming action is pressed. */
  onConfirm: () => void
  /** The question, put as a statement. Becomes the accessible name. */
  title: string
  /** What is about to happen, and to what. Name the consequence, not the mechanism. */
  description: string
  /** Label for the confirming action. Name the verb rather than saying OK. */
  confirmLabel?: string
  /** Label for the way out. */
  cancelLabel?: string
  /** Colours the confirming action as dangerous. */
  destructive?: boolean
  /** Shows a spinner in the confirming action and blocks it. */
  busy?: boolean
  /** Require the user to type this exactly before confirming. */
  confirmationText?: string
}

/**
 * AlertDialog with the standard confirm and cancel pair, plus optional typed
 * confirmation for the genuinely irreversible cases.
 *
 * Typed confirmation is a deliberate speed bump — reserve it for actions that
 * destroy data. Asking for it routinely trains people to type past it.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  confirmationText,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const locked = Boolean(confirmationText) && typed.trim() !== confirmationText

  return (
    <AlertDialog
      open={open}
      onClose={() => {
        setTyped('')
        onClose()
      }}
      onConfirm={() => {
        if (locked) return
        setTyped('')
        onConfirm()
      }}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      destructive={destructive}
      busy={busy}
      confirmDisabled={locked}
    >
      {confirmationText && (
        <div className="mt-1 flex flex-col gap-1.5">
          <Text as="label" size="caption" tone="soft" htmlFor="confirm-input">
            Type <strong className="font-bold text-ink">{confirmationText}</strong> to continue
          </Text>
          <Input
            id="confirm-input"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={confirmationText}
            autoComplete="off"
          />
        </div>
      )}
    </AlertDialog>
  )
}
