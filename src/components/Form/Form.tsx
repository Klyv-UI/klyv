import type { FormHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export type FormProps = FormHTMLAttributes<HTMLFormElement> & {
  /** Vertical rhythm between fields. */
  gap?: 'sm' | 'md' | 'lg'
  /** The fields, and the actions that submit them. */
  children: ReactNode
}

const GAPS = { sm: 'gap-3', md: 'gap-4', lg: 'gap-5' } as const

/**
 * A native form with the library rhythm applied. It stays a real form element,
 * so Enter submits and the browser validation model still works — validation
 * itself is left to the application rather than baked in here.
 */
export function Form({ className, gap = 'md', children, ...props }: FormProps) {
  return (
    <form className={cn('flex flex-col', GAPS[gap], className)} {...props}>
      {children}
    </form>
  )
}

export interface FormSectionProps {
  title?: string
  description?: string
  children: ReactNode
  className?: string
}

/** A titled group of fields inside a Form. */
export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <fieldset className={cn('m-0 flex min-w-0 flex-col gap-3 border-0 p-0', className)}>
      {title && (
        <legend className="mb-1 p-0">
          <Text as="span" size="heading">
            {title}
          </Text>
        </legend>
      )}
      {description && (
        <Text size="caption" tone="faint" leading="normal" className="-mt-1">
          {description}
        </Text>
      )}
      {children}
    </fieldset>
  )
}

/** Actions row, aligned to the end by default. */
export function FormActions({
  children,
  align = 'end',
  className,
}: {
  children: ReactNode
  align?: 'start' | 'end' | 'between'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 pt-1',
        align === 'end' && 'justify-end',
        align === 'between' && 'justify-between',
        className,
      )}
    >
      {children}
    </div>
  )
}
