'use client'

import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean
  /** Whether the user may drag-resize. Defaults to vertical only. */
  resize?: 'none' | 'vertical'
}

/**
 * Multi-line sibling of Input. Shares its chrome but uses the field radius
 * rather than a pill, because a multi-line pill reads badly.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid = false, resize = 'vertical', rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full min-w-0 rounded-[var(--radius-field)] border border-line bg-surface px-4 py-3',
        'text-[13px] font-medium leading-normal text-ink outline-none transition-colors',
        'placeholder:text-ink-faint focus:border-line-strong',
        'disabled:cursor-not-allowed disabled:opacity-40',
        resize === 'none' ? 'resize-none' : 'resize-y',
        invalid && 'border-danger focus:border-danger',
        className,
      )}
      {...props}
    />
  )
})
