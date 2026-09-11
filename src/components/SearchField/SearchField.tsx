'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { IconButton } from '../IconButton'
import { Input, type InputSize } from '../Input'
import { CrossIcon, SearchIcon } from '../internal/icons'

export type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> & {
  value: string
  onValueChange: (value: string) => void
  /** Control height, matching Input. */
  inputSize?: InputSize
  /** Accessible name. Required, since the icon is not a label. */
  label?: string
  /** Hide the clear control even when there is text. */
  clearable?: boolean
  /** Classes for the wrapper rather than the control itself. */
  containerClassName?: string
}

/**
 * Input with a search glyph and a clear control that appears once there is
 * something to clear. Clearing returns focus to the field, so the user is not
 * dropped at the end of the document after emptying it.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    value,
    onValueChange,
    inputSize = 'md',
    label = 'Search',
    clearable = true,
    placeholder = 'Search',
    containerClassName,
    ...props
  },
  ref,
) {
  return (
    <Input
      ref={ref}
      type="search"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      aria-label={label}
      placeholder={placeholder}
      inputSize={inputSize}
      containerClassName={containerClassName}
      leading={<SearchIcon size={15} />}
      trailing={
        clearable && value ? (
          <IconButton
            icon={CrossIcon}
            label={`Clear ${label.toLowerCase()}`}
            size="xs"
            onClick={(event) => {
              onValueChange('')
              const field = event.currentTarget
                .closest('div')
                ?.querySelector<HTMLInputElement>('input')
              field?.focus()
            }}
          />
        ) : undefined
      }
      {...props}
    />
  )
})
