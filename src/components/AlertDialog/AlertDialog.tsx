'use client'

import type { ReactNode } from 'react'
import { Button } from '../Button'
import { Modal } from '../Modal'

export interface AlertDialogProps {
  /** Whether the dialog is showing. */
  open: boolean
  /** Called on cancel, on Escape, and on a backdrop click. */
  onClose: () => void
  /** The question. Becomes the accessible name. */
  title: string
  /** Its consequence. */
  description: string
  /** The body: what happened, and what can be done about it. */
  children?: ReactNode
  /** Text on the confirming button. Name the action, not just "OK". */
  confirmLabel?: string
  /** Label for the dismissing action. */
  cancelLabel?: string
  onConfirm: () => void
  /** Reddens the confirm button, for a destructive action. */
  destructive?: boolean
  /** Disables both buttons and shows a spinner while the action runs. */
  busy?: boolean
  /** Disables confirming without implying that work is happening. */
  confirmDisabled?: boolean
}

/**
 * A dialog that forces a choice. It uses alertdialog semantics, has no close
 * control and cannot be dismissed by Escape or the backdrop — because a
 * question the user can dismiss by accident is a question that will be.
 *
 * The confirm label should name the action ("Delete recipient"), not agree with
 * a question ("Yes"), so it still makes sense read on its own.
 */
export function AlertDialog({
  open,
  onClose,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  destructive = false,
  busy = false,
  confirmDisabled = false,
}: AlertDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      role="alertdialog"
      dismissible={false}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            loading={busy}
            disabled={confirmDisabled}
            onClick={onConfirm}
            className={destructive ? 'bg-danger text-white hover:bg-danger/90' : undefined}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
