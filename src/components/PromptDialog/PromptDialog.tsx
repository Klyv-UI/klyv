'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../Button'
import { Field } from '../Field'
import { Input } from '../Input'
import { Modal } from '../Modal'

export type PromptDialogSelection = 'all' | 'name' | 'end'

export interface PromptDialogProps {
  /** Whether the dialog is showing. */
  open: boolean
  /** Called on Cancel, Escape, the backdrop, and after a successful submit. */
  onClose: () => void
  /** The question — “Rename file”. Becomes the accessible name. */
  title: string
  /** Supporting line under the title. */
  description?: string
  /** Visible label for the field. */
  label: string
  /** The value the field starts with each time the dialog opens. */
  defaultValue?: string
  placeholder?: string
  /**
   * What is selected when the dialog opens. `name` selects up to the last dot,
   * so renaming `report.pdf` replaces “report” and keeps the extension.
   */
  selection?: PromptDialogSelection
  /** Returns a message when the value cannot be submitted. Runs on every change. */
  validate?: (value: string) => string | undefined
  /** Receives the trimmed value. A rejected promise keeps the dialog open with its message. */
  onSubmit: (value: string) => void | Promise<void>
  /** Label for the submitting action. Name the verb. */
  confirmLabel?: string
  cancelLabel?: string
  /** Blank values are refused. */
  required?: boolean
  /** Maximum length, enforced by the field. */
  maxLength?: number
}

/**
 * A dialog that asks for exactly one value — a new name, a folder to create.
 *
 * It opens with the text already selected, so typing replaces it, and `name`
 * selection leaves a file extension alone. Submit is disabled while the value
 * is invalid, but the reason only appears once the person has typed: a dialog
 * that opens already shouting “required” is scolding someone who has not done
 * anything yet. Enter submits, and a failed submit stays open with the
 * server’s message beside the field, where the fix will be made.
 */
export function PromptDialog({
  open,
  onClose,
  title,
  description,
  label,
  defaultValue = '',
  placeholder,
  selection = 'all',
  validate,
  onSubmit,
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  required = true,
  maxLength,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue)
  const [touched, setTouched] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const formId = useId()

  useEffect(() => {
    if (!open) return
    setValue(defaultValue)
    setTouched(false)
    setFailure(null)
    // After the focus trap has placed focus on its first control.
    const frame = requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      const dot = input.value.lastIndexOf('.')
      if (selection === 'name' && dot > 0) input.setSelectionRange(0, dot)
      else if (selection === 'end') input.setSelectionRange(input.value.length, input.value.length)
      else input.select()
    })
    return () => cancelAnimationFrame(frame)
    // Reset only when the dialog opens, not whenever the caller re-renders.
  }, [open])

  const trimmed = value.trim()
  const problem = required && !trimmed ? `Enter a ${label.toLowerCase()}.` : validate?.(trimmed)
  const shownError = failure ?? (touched ? problem : undefined)

  const submit = async () => {
    setTouched(true)
    if (problem || pending) return
    setPending(true)
    setFailure(null)
    try {
      await onSubmit(trimmed)
      onClose()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'That did not work. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      dismissible={!pending}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button type="submit" form={formId} size="sm" loading={pending} disabled={Boolean(problem)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
        className="mt-1"
      >
        <Field label={label} error={shownError ?? undefined}>
          <Input
            ref={inputRef}
            value={value}
            placeholder={placeholder}
            maxLength={maxLength}
            autoComplete="off"
            spellCheck={false}
            readOnly={pending}
            onChange={(event) => {
              setValue(event.target.value)
              setTouched(true)
              setFailure(null)
            }}
          />
        </Field>
      </form>
    </Modal>
  )
}
