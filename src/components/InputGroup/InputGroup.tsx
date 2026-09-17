import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type InputGroupSize = 'sm' | 'md'
export type InputGroupAddonVariant = 'text' | 'plain' | 'control'

const SIZES: Record<InputGroupSize, string> = {
  sm: 'h-9 text-[12px]',
  md: 'h-10 text-[13px]',
}

const ADDONS: Record<InputGroupAddonVariant, string> = {
  text: 'bg-surface-muted px-3.5 font-semibold text-ink-soft',
  plain: 'px-3 text-ink-faint',
  control: '[&>*]:h-full [&>*]:rounded-none',
}

export interface InputGroupAddonProps {
  /** Text, an icon, a Button or a native select. */
  children: ReactNode
  /** `text` is a tinted label cell, `plain` an unfilled glyph cell, `control` hands the whole cell to an interactive child. */
  variant?: InputGroupAddonVariant
  /** Merged last, so it wins. */
  className?: string
}

/** A cell attached to the start or end of an InputGroup. */
export function InputGroupAddon({ children, variant = 'text', className }: InputGroupAddonProps) {
  return (
    <span data-addon={variant} className={cn('flex shrink-0 items-center whitespace-nowrap', ADDONS[variant], className)}>
      {children}
    </span>
  )
}

export interface InputGroupProps {
  /** InputGroupAddon cells and one Input, in visual order. */
  children: ReactNode
  /** Height and type size of the joined control. */
  size?: InputGroupSize
  /** Reddens the shared border and marks the input invalid. */
  invalid?: boolean
  /** Disables every control inside, through the fieldset. */
  disabled?: boolean
  /** Name for the group, when the addons alone do not explain it. */
  label?: string
  /** Forwarded to the first non-addon child, so a Field label reaches the input. */
  id?: string
  /** Forwarded to the first non-addon child. */
  'aria-describedby'?: string
  /** Forwarded to the first non-addon child. */
  required?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Joins addons — a scheme, a currency, a unit, a button — to an Input so they
 * share one border, one radius and one focus ring. Put side by side instead,
 * they read as separate questions.
 *
 * It is layout only: the Input keeps its own behaviour and the group flattens
 * its chrome. The group is a disabled-able fieldset, so one prop disables every
 * control inside, and whatever Field hands it — id, description, invalid,
 * required — goes on to the input, so `<Field><InputGroup>` labels correctly.
 */
export function InputGroup({
  children,
  size = 'md',
  invalid = false,
  disabled = false,
  label,
  id,
  'aria-describedby': describedBy,
  required,
  className,
}: InputGroupProps) {
  let forwarded = false
  const items = Children.map(children, (child) => {
    if (forwarded || !isValidElement(child) || child.type === InputGroupAddon) return child
    forwarded = true
    const element = child as ReactElement<Record<string, unknown>>
    return cloneElement(element, {
      ...(id ? { id } : null),
      ...(describedBy ? { 'aria-describedby': describedBy } : null),
      ...(invalid ? { invalid: true } : null),
      ...(required ? { required: true } : null),
      containerClassName: cn('min-w-0 flex-1 self-stretch', element.props.containerClassName as string | undefined),
    })
  })

  return (
    <fieldset
      disabled={disabled}
      aria-label={label}
      className={cn(
        'm-0 flex w-full min-w-0 items-stretch overflow-hidden rounded-full border bg-surface p-0 transition-colors',
        'focus-within:border-line-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
        // Flatten the Input's own pill so the group's border is the only one.
        '[&_input]:h-full [&_input]:rounded-none [&_input]:border-0 [&_input]:bg-transparent [&_input]:outline-none',
        // Separators between cells, skipped next to a plain glyph cell.
        '[&>*+*]:border-l [&>*+*]:border-line [&>[data-addon=plain]]:border-l-0 [&>[data-addon=plain]+*]:border-l-0 [&>[data-addon=plain]+*_input]:pl-0',
        // A button or select inside is clipped by the rounded edge, so its ring goes inside.
        '[&_select]:outline-none [&_button:focus-visible]:outline-offset-[-2px]',
        invalid ? 'border-danger focus-within:border-danger' : 'border-line',
        disabled && 'opacity-40',
        SIZES[size],
        className,
      )}
    >
      {items}
    </fieldset>
  )
}
