import type { LabelHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  /** Marks the associated control as required. */
  required?: boolean
  /** Dims the label alongside a disabled control. */
  disabled?: boolean
}

/**
 * Form label on the `label` type step. It owns the htmlFor association and
 * nothing else: layout, hints and errors belong to Field.
 */
export function Label({ className, required = false, disabled = false, children, ...props }: LabelProps) {
  return (
    <Text
      as="label"
      size="label"
      weight="semibold"
      tone="soft"
      className={cn(disabled && 'opacity-40', className)}
      {...props}
    >
      {children}
      {required && (
        <span className="text-danger" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </Text>
  )
}
