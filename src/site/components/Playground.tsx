import type { ReactNode } from 'react'
import { useId } from 'react'
import { Surface, Text, cn } from 'citrine'

/**
 * A deliberately small playground: a live stage, and a column of controls the
 * page wires up with its own `useState`. No schema, no code generation — the
 * point is to feel a component's props, not to replace an editor.
 */

interface PlaygroundProps {
  /** The live component. */
  stage: ReactNode
  /** Control column — compose the controls below. */
  controls: ReactNode
  background?: 'surface' | 'app' | 'accent'
}

export function Playground({ stage, controls, background = 'surface' }: PlaygroundProps) {
  return (
    <Surface variant="card" className="grid gap-0 overflow-hidden md:grid-cols-[1fr_260px]">
      <div
        className={cn(
          'flex min-h-[220px] items-center justify-center p-8',
          background === 'app' && 'bg-app',
          background === 'accent' && 'bg-accent',
        )}
      >
        {stage}
      </div>
      <div className="flex flex-col gap-4 border-t border-line bg-surface-sunken p-5 md:border-l md:border-t-0">
        <Text size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
          Controls
        </Text>
        {controls}
      </div>
    </Surface>
  )
}

function ControlLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor}>
      <Text as="span" size="caption" weight="semibold" tone="soft">
        {children}
      </Text>
    </label>
  )
}

interface SelectControlProps<T extends string> {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}

export function SelectControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SelectControlProps<T>) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <ControlLabel htmlFor={id}>{label}</ControlLabel>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-9 w-full rounded-[10px] border border-line bg-surface px-2.5 text-[12px] font-semibold text-ink outline-none transition-colors hover:border-line-strong focus:border-line-strong"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

interface TextControlProps {
  label: string
  value: string
  onChange: (value: string) => void
}

export function TextControl({ label, value, onChange }: TextControlProps) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <ControlLabel htmlFor={id}>{label}</ControlLabel>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-[10px] border border-line bg-surface px-2.5 text-[12px] font-semibold text-ink outline-none transition-colors hover:border-line-strong focus:border-line-strong"
      />
    </div>
  )
}

interface ToggleControlProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function ToggleControl({ label, checked, onChange }: ToggleControlProps) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-3">
      <ControlLabel htmlFor={id}>{label}</ControlLabel>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-accent-strong' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute size-4 rounded-full bg-white shadow-[var(--shadow-tile)] transition-[left]',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  )
}

interface NumberControlProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}

export function NumberControl({ label, value, min, max, step = 1, onChange }: NumberControlProps) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <ControlLabel htmlFor={id}>{label}</ControlLabel>
        <Text as="span" size="caption" weight="bold" tabular>
          {value}
        </Text>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line-strong accent-[var(--color-accent-strong)]"
      />
    </div>
  )
}
