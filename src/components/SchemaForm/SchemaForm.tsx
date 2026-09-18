'use client'

import { useId, useState, type FormEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Checkbox } from '../Checkbox'
import { Field } from '../Field'
import { Input } from '../Input'
import { Label } from '../Label'
import { InlineMessage } from '../InlineMessage'
import { RepeaterField } from '../RepeaterField'
import { Select } from '../Select'

/** The subset of JSON Schema the form understands. Unknown keywords are ignored. */
export interface SchemaFormSchema {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array'
  /** The field label. Falls back to the property name, de-camel-cased. */
  title?: string
  /** Shown under the field as a hint. */
  description?: string
  /** For strings: how to render and check them. */
  format?: 'email' | 'date' | 'uri'
  /** Fixed choices, rendered as a select. */
  enum?: (string | number)[]
  /** Labels for `enum`, in the same order. */
  enumLabels?: string[]
  minLength?: number
  maxLength?: number
  /** A regular expression the whole string must match. */
  pattern?: string
  /** Said instead of the generic message when `pattern` fails. */
  patternMessage?: string
  minimum?: number
  maximum?: number
  /** For objects: the fields, in order. */
  properties?: Record<string, SchemaFormSchema>
  /** For objects: the property names that must be filled. */
  required?: string[]
  /** For arrays: the schema of one item. */
  items?: SchemaFormSchema
  minItems?: number
  maxItems?: number
  /** Starting value when the form is uncontrolled. */
  default?: unknown
}

export interface SchemaFormProps<T = unknown> {
  /** The schema to render. The root is usually an object. */
  schema: SchemaFormSchema
  /** Controlled value. */
  value?: T
  /** Starting value when uncontrolled. Defaults are built from the schema. */
  defaultValue?: T
  /** Called with the whole value after every edit. */
  onValueChange?: (value: T) => void
  /** Called with the value once it passes every rule in the schema. */
  onSubmit?: (value: T) => void
  /** Text of the submit button. */
  submitLabel?: string
  /** Merged last, so it wins. */
  className?: string
}

type Path = (string | number)[]
type Errors = Map<string, string>
type Json = Record<string, unknown>

const keyOf = (path: Path) => path.join('.')
const humanise = (name: string) => name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase())
const isEmpty = (value: unknown) => value === undefined || value === null || value === '' || (typeof value === 'number' && Number.isNaN(value))

/** The value a fresh field starts with. */
export function schemaFormDefault(schema: SchemaFormSchema): unknown {
  if (schema.default !== undefined) return schema.default
  if (schema.type === 'object') return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, child]) => [key, schemaFormDefault(child)]))
  if (schema.type === 'array') return Array.from({ length: schema.minItems ?? 0 }, () => schemaFormDefault(schema.items ?? { type: 'string' }))
  if (schema.type === 'boolean') return false
  return schema.type === 'string' ? '' : undefined
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function checkOne(schema: SchemaFormSchema, value: unknown): string | null {
  if (isEmpty(value)) return null
  if (schema.enum && !schema.enum.map(String).includes(String(value))) return 'Choose one of the listed options.'
  if (schema.type === 'string' && typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) return `Enter at least ${plural(schema.minLength, 'character')}.`
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return `Keep it to ${plural(schema.maxLength, 'character')} or fewer.`
    if (schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter an email address, like name@example.com.'
    if (schema.format === 'uri') {
      try {
        new URL(value)
      } catch {
        return 'Enter a full address, starting with https://.'
      }
    }
    if (schema.format === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))) return 'Enter a date as YYYY-MM-DD.'
    if (schema.pattern && !new RegExp(`^(?:${schema.pattern})$`).test(value)) return schema.patternMessage ?? 'This is not in the expected format.'
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    if (typeof value !== 'number') return 'Enter a number.'
    if (schema.type === 'integer' && !Number.isInteger(value)) return 'Enter a whole number.'
    if (schema.minimum !== undefined && value < schema.minimum) return `Enter ${schema.minimum} or more.`
    if (schema.maximum !== undefined && value > schema.maximum) return `Enter ${schema.maximum} or less.`
  }
  return null
}

/** Every rule the value breaks, keyed by dotted path — `contacts.1.email`. */
export function schemaFormValidate(schema: SchemaFormSchema, value: unknown, path: Path = [], errors: Errors = new Map()): Errors {
  const own = checkOne(schema, value)
  if (own) errors.set(keyOf(path), own)
  if (schema.type === 'object') {
    const record = (value ?? {}) as Json
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      const childValue = record[key]
      const required = schema.required?.includes(key)
      if (required && (isEmpty(childValue) || (child.type === 'boolean' && childValue !== true))) {
        errors.set(keyOf([...path, key]), child.type === 'boolean' ? 'This needs to be ticked.' : 'This is required.')
      } else schemaFormValidate(child, childValue, [...path, key], errors)
    }
  }
  if (schema.type === 'array') {
    const list = Array.isArray(value) ? value : []
    if (schema.minItems !== undefined && list.length < schema.minItems) errors.set(keyOf(path), `Add at least ${schema.minItems}.`)
    if (schema.maxItems !== undefined && list.length > schema.maxItems) errors.set(keyOf(path), `Keep it to ${schema.maxItems} or fewer.`)
    list.forEach((item, index) => schemaFormValidate(schema.items ?? { type: 'string' }, item, [...path, index], errors))
  }
  return errors
}

function setIn(target: unknown, path: Path, next: unknown): unknown {
  if (path.length === 0) return next
  const [head, ...rest] = path
  if (typeof head === 'number') {
    const list = Array.isArray(target) ? [...target] : []
    list[head] = setIn(list[head], rest, next)
    return list
  }
  const record = { ...((target ?? {}) as Json) }
  record[head] = setIn(record[head], rest, next)
  return record
}

interface NodeContext {
  uid: string
  errorFor: (path: Path) => string | undefined
  change: (path: Path, next: unknown) => void
  touch: (path: Path) => void
}

/**
 * A working form drawn from a JSON Schema — for settings defined by a plugin,
 * the config of an integration, anything whose shape is data rather than code.
 *
 * It renders the library's own fields rather than a generic widget set:
 * strings become inputs with the right type, enums become a Select, booleans a
 * Checkbox, nested objects a fieldset, arrays a RepeaterField. Validation runs
 * the same schema the fields were drawn from, so the two can never disagree. A
 * field shows its error once it has been left or the form submitted — never
 * while the first character is being typed — and a failed submit moves focus to
 * the first field that needs attention.
 */
export function SchemaForm<T = unknown>({
  schema,
  value,
  defaultValue,
  onValueChange,
  onSubmit,
  submitLabel = 'Save',
  className,
}: SchemaFormProps<T>) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState<unknown>(() => defaultValue ?? schemaFormDefault(schema))
  const current = value ?? uncontrolled
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const errors = schemaFormValidate(schema, current)

  const context: NodeContext = {
    uid,
    errorFor: (path) => (submitted || touched.has(keyOf(path)) ? errors.get(keyOf(path)) : undefined),
    change: (path, next) => {
      const updated = setIn(current, path, next)
      if (value === undefined) setUncontrolled(updated)
      onValueChange?.(updated as T)
    },
    touch: (path) => setTouched((set) => (set.has(keyOf(path)) ? set : new Set(set).add(keyOf(path)))),
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (errors.size === 0) return onSubmit?.(current as T)
    const first = [...errors.keys()]
      .map((key) => document.getElementById(`${uid}-${key}`))
      .find((node) => node)
    ;(first?.matches('input, button') ? first : first?.querySelector<HTMLElement>('input, button'))?.focus()
  }

  return (
    <form noValidate onSubmit={submit} className={cn('flex w-full flex-col gap-4', className)}>
      <SchemaNode schema={schema} value={current} path={[]} context={context} />
      <div className="flex items-center gap-3">
        <Button type="submit">{submitLabel}</Button>
        <span role="status" className="text-[12px] font-medium text-ink-faint">
          {submitted && errors.size > 0 ? `${plural(errors.size, 'field')} need${errors.size === 1 ? 's' : ''} attention.` : ''}
        </span>
      </div>
    </form>
  )
}

interface SchemaNodeProps {
  schema: SchemaFormSchema
  value: unknown
  path: Path
  context: NodeContext
  name?: string
  required?: boolean
  hideLabel?: boolean
}

function SchemaNode({ schema, value, path, context, name = '', required = false, hideLabel = false }: SchemaNodeProps) {
  const id = `${context.uid}-${keyOf(path)}`
  const label = schema.title ?? humanise(name)
  const error = context.errorFor(path)
  const onBlur = () => context.touch(path)

  if (schema.type === 'object') {
    const fields = Object.entries(schema.properties ?? {}).map(([key, child]) => (
      <SchemaNode key={key} schema={child} value={(value as Json | undefined)?.[key]} path={[...path, key]} context={context} name={key} required={schema.required?.includes(key)} />
    ))
    if (path.length === 0) return <div className="flex flex-col gap-4">{fields}</div>
    return (
      <fieldset className="flex flex-col gap-4 rounded-[var(--radius-tile)] border border-line p-4">
        <legend className="px-1 text-[13px] font-bold text-ink">{label}</legend>
        {schema.description && <p className="-mt-2 text-[12px] font-medium text-ink-faint">{schema.description}</p>}
        {fields}
      </fieldset>
    )
  }

  if (schema.type === 'array') {
    const itemSchema = schema.items ?? { type: 'string' }
    const list = Array.isArray(value) ? value : []
    return (
      <div id={id} className="flex flex-col gap-1.5">
        <RepeaterField<{ item: unknown }>
          label={label}
          itemLabel={itemSchema.title?.toLowerCase() ?? 'item'}
          value={list.map((item) => ({ item }))}
          onValueChange={(rows) => {
            context.change(
              path,
              rows.map((row) => row.item),
            )
            context.touch(path)
          }}
          createRow={() => ({ item: schemaFormDefault(itemSchema) })}
          min={schema.minItems}
          max={schema.maxItems}
          renderRow={(row, { index }) => <SchemaNode schema={{ ...itemSchema, title: `${itemSchema.title ?? humanise(name)} ${index + 1}` }} value={row.item} path={[...path, index]} context={context} name={name} hideLabel={itemSchema.type !== 'object'} />}
        />
        {error && (
          <InlineMessage tone="danger" live>
            {error}
          </InlineMessage>
        )}
      </div>
    )
  }

  if (schema.type === 'boolean') {
    const messageId = `${id}-message`
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <Checkbox id={id} checked={value === true} invalid={Boolean(error)} aria-describedby={error || schema.description ? messageId : undefined} onChange={(event) => context.change(path, event.target.checked)} onBlur={onBlur} />
          <Label htmlFor={id} required={required}>
            {label}
          </Label>
        </div>
        {(error || schema.description) && (
          <InlineMessage id={messageId} tone={error ? 'danger' : 'hint'} live={Boolean(error)}>
            {error ?? schema.description}
          </InlineMessage>
        )}
      </div>
    )
  }

  const numeric = schema.type === 'number' || schema.type === 'integer'
  if (schema.enum) {
    const options = [{ value: '', label: 'Choose…' }, ...schema.enum.map((option, index) => ({ value: String(option), label: schema.enumLabels?.[index] ?? String(option) }))]
    return (
      <Field label={label} hint={schema.description} error={error} required={required} hideLabel={hideLabel}>
        <Select
          id={id}
          label={label}
          options={options}
          value={isEmpty(value) ? '' : String(value)}
          onValueChange={(next) => {
            context.change(path, next === '' ? undefined : numeric ? Number(next) : next)
            context.touch(path)
          }}
          invalid={Boolean(error)}
          fullWidth
        />
      </Field>
    )
  }

  const type = numeric ? 'number' : schema.format === 'email' ? 'email' : schema.format === 'date' ? 'date' : schema.format === 'uri' ? 'url' : 'text'
  return (
    <Field label={label} hint={schema.description} error={error} required={required} hideLabel={hideLabel}>
      <Input
        id={id}
        type={type}
        inputMode={schema.type === 'integer' ? 'numeric' : numeric ? 'decimal' : undefined}
        min={schema.minimum}
        max={schema.maximum}
        step={schema.type === 'integer' ? 1 : numeric ? 'any' : undefined}
        value={isEmpty(value) ? '' : String(value)}
        onChange={(event) => {
          const raw = event.target.value
          context.change(path, numeric ? (raw === '' ? undefined : Number(raw)) : raw)
        }}
        onBlur={onBlur}
      />
    </Field>
  )
}
