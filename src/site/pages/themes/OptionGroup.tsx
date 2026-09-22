import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from 'klyvui'

export interface Option<T extends string> {
  value: T
  /** The accessible name. Swatches have no visible text, so this is required. */
  label: string
  /** Read after the name, for a detail the visual carries (colours, a description). */
  description?: string
}

/**
 * A radio group drawn as whatever the options need to look like — swatches,
 * cards, font names.
 *
 * One tab stop for the whole group, arrow keys move and select, Home and End
 * jump, as a native radio group does. The library's SegmentedControl does the
 * same for text; this is the version whose options are pictures.
 */
export function OptionGroup<T extends string>({
  labelledBy,
  options,
  value,
  onValueChange,
  render,
  className,
  optionClassName,
}: {
  /** The id of the visible heading that names the group. */
  labelledBy: string
  options: Option<T>[]
  /** The selected value, or null when none of the options is the current one (a custom colour). */
  value: T | null
  onValueChange: (value: T) => void
  render: (option: Option<T>, selected: boolean) => ReactNode
  className?: string
  optionClassName?: string | ((selected: boolean) => string)
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = options.findIndex((option) => option.value === value)
  const tabStop = selectedIndex === -1 ? 0 : selectedIndex

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const last = options.length - 1
    let next: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === null) return
    event.preventDefault()
    onValueChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={className}>
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.description ? `${option.label}, ${option.description}` : option.label}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              typeof optionClassName === 'function' ? optionClassName(selected) : optionClassName,
            )}
          >
            {render(option, selected)}
          </button>
        )
      })}
    </div>
  )
}
