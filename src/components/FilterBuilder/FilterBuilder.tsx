'use client'

import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { Input } from '../Input'
import { Text } from '../Text'
import { SegmentedControl } from '../SegmentedControl'
import { Select } from '../Select'
import { CrossIcon, PlusIcon } from '../internal/icons'

export type FilterFieldType = 'text' | 'number' | 'select' | 'date'

export interface FilterField {
  id: string
  label: string
  type: FilterFieldType
  /** Choices, for a select field. */
  options?: { value: string; label: string }[]
}

export interface FilterCondition {
  id: string
  field: string
  operator: string
  value: string
}

export type FilterMatch = 'all' | 'any'

const OPERATORS: Record<FilterFieldType, { value: string; label: string }[]> = {
  text: [
    { value: 'contains', label: 'contains' },
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'empty', label: 'is empty' },
    { value: 'not_empty', label: 'is not empty' },
  ],
  number: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
  ],
  select: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
  ],
  date: [
    { value: 'before', label: 'is before' },
    { value: 'after', label: 'is after' },
  ],
}

const NO_VALUE = new Set(['empty', 'not_empty'])

/**
 * Whether one row passes a set of conditions. Exported so the table and the
 * builder can never disagree about what a filter means.
 */
export function matchesFilters<Row>(
  row: Row,
  conditions: FilterCondition[],
  match: FilterMatch,
  fields: FilterField[],
  get: (row: Row, fieldId: string) => unknown,
): boolean {
  const active = conditions.filter((condition) => NO_VALUE.has(condition.operator) || condition.value !== '')
  if (active.length === 0) return true

  const test = (condition: FilterCondition) => {
    const field = fields.find((item) => item.id === condition.field)
    const raw = get(row, condition.field)
    const text = raw == null ? '' : String(raw)
    const lower = text.toLowerCase()
    const target = condition.value.toLowerCase()
    switch (field?.type === 'number' ? `n:${condition.operator}` : condition.operator) {
      case 'contains': return lower.includes(target)
      case 'is': return lower === target
      case 'is_not': return lower !== target
      case 'starts_with': return lower.startsWith(target)
      case 'empty': return text.trim() === ''
      case 'not_empty': return text.trim() !== ''
      case 'n:eq': return Number(raw) === Number(condition.value)
      case 'n:neq': return Number(raw) !== Number(condition.value)
      case 'n:gt': return Number(raw) > Number(condition.value)
      case 'n:lt': return Number(raw) < Number(condition.value)
      case 'before': return text !== '' && text < condition.value
      case 'after': return text !== '' && text > condition.value
      default: return true
    }
  }

  return match === 'all' ? active.every(test) : active.some(test)
}

export interface FilterBuilderProps {
  fields: FilterField[]
  value: FilterCondition[]
  onChange: (value: FilterCondition[]) => void
  match: FilterMatch
  onMatchChange: (match: FilterMatch) => void
  /** Accessible name for the group. */
  label?: string
  className?: string
}

let counter = 0
const newId = () => `condition-${Date.now().toString(36)}-${(counter += 1)}`

/**
 * Field, operator, value — as many rows as the question needs, joined by all
 * or any.
 *
 * FilterBar is the quick path: a few chips for the filters everyone uses. This
 * is the other one, for "plan is Team and MRR > 500 and last seen before
 * June". Operators follow the field's type, so a number never offers
 * "contains", and a condition with an empty value is ignored rather than
 * matching nothing — a half-typed row should not blank the table.
 */
export function FilterBuilder({
  fields,
  value,
  onChange,
  match,
  onMatchChange,
  label = 'Filters',
  className,
}: FilterBuilderProps) {
  const fieldOf = (id: string) => fields.find((field) => field.id === id) ?? fields[0]!

  const update = (id: string, patch: Partial<FilterCondition>) =>
    onChange(value.map((condition) => (condition.id === id ? { ...condition, ...patch } : condition)))

  const add = () => {
    const field = fields[0]
    if (!field) return
    onChange([...value, { id: newId(), field: field.id, operator: OPERATORS[field.type][0]!.value, value: '' }])
  }

  return (
    <div role="group" aria-label={label} className={cn('flex flex-col gap-3', className)}>
      {value.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <Text as="span" size="caption" weight="semibold" tone="soft">
            Show rows that match
          </Text>
          <SegmentedControl
            label="Match"
            size="sm"
            value={match}
            onValueChange={onMatchChange}
            options={[
              { value: 'all', label: 'all' },
              { value: 'any', label: 'any' },
            ]}
          />
          <Text as="span" size="caption" weight="semibold" tone="soft">
            of these conditions
          </Text>
        </div>
      )}

      {value.length === 0 ? (
        <Text size="caption" tone="faint">
          No conditions — every row is shown.
        </Text>
      ) : (
        <ol className="flex flex-col gap-2">
          {value.map((condition, index) => {
            const field = fieldOf(condition.field)
            const operators = OPERATORS[field.type]
            const needsValue = !NO_VALUE.has(condition.operator)
            const prefix = index === 0 ? 'Where' : match === 'all' ? 'and' : 'or'
            const name = `Condition ${index + 1}`

            return (
              <li
                key={condition.id}
                className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-[var(--radius-tile)] border border-line bg-surface p-2 sm:grid-cols-[52px_minmax(0,160px)_minmax(0,140px)_minmax(0,1fr)_auto] sm:border-0 sm:bg-transparent sm:p-0"
              >
                <Text as="span" size="caption" weight="bold" tone="faint" className="col-span-2 sm:col-span-1 sm:text-right">
                  {prefix}
                </Text>
                <Select
                  label={`${name} field`}
                  size="sm"
                  fullWidth
                  value={condition.field}
                  onValueChange={(next) => {
                    const nextField = fieldOf(next)
                    update(condition.id, { field: next, operator: OPERATORS[nextField.type][0]!.value, value: '' })
                  }}
                  options={fields.map((item) => ({ value: item.id, label: item.label }))}
                  className="col-span-2 sm:col-span-1"
                />
                <Select
                  label={`${name} operator`}
                  size="sm"
                  fullWidth
                  value={condition.operator}
                  onValueChange={(operator) => update(condition.id, { operator, value: NO_VALUE.has(operator) ? '' : condition.value })}
                  options={operators}
                  className="col-span-2 sm:col-span-1"
                />
                <div className="min-w-0">
                  {needsValue &&
                    (field.type === 'select' ? (
                      <Select
                        label={`${name} value`}
                        size="sm"
                        fullWidth
                        value={condition.value || field.options?.[0]?.value || ''}
                        onValueChange={(next) => update(condition.id, { value: next })}
                        options={field.options ?? []}
                      />
                    ) : (
                      <Input
                        inputSize="sm"
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        value={condition.value}
                        onChange={(event) => update(condition.id, { value: event.target.value })}
                        placeholder="Value"
                        aria-label={`${name} value`}
                      />
                    ))}
                </div>
                <IconButton
                  icon={CrossIcon}
                  label={`Remove condition ${index + 1}`}
                  size="xs"
                  onClick={() => onChange(value.filter((item) => item.id !== condition.id))}
                />
              </li>
            )
          })}
        </ol>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={add}>
          <PlusIcon size={12} />
          Add condition
        </Button>
        {value.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>
            Clear all
          </Button>
        )}
      </div>
    </div>
  )
}
