'use client'

import { useId, useMemo, useState, type FormEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Checkbox } from '../Checkbox'
import { IconButton } from '../IconButton'
import { Input } from '../Input'
import { SegmentedControl } from '../SegmentedControl'
import { Select } from '../Select'
import { Text } from '../Text'
import { CrossIcon } from '../internal/icons'

export interface ExpenseSplitterPerson {
  id: string
  name: string
}

export type ExpenseSplitterMode = 'equal' | 'shares' | 'exact' | 'percent'

export interface ExpenseSplitterExpense {
  id: string
  description: string
  /** Integer minor units — cents for USD, yen for JPY. Never a float. */
  amount: number
  /** Person id who paid. */
  paidBy: string
  mode: ExpenseSplitterMode
  /** Person id → weight: ignored for equal, shares for shares, minor units for exact, percent for percent. */
  split: Record<string, number>
}

export interface ExpenseSplitterTransfer {
  from: string
  to: string
  amount: number
}

export interface ExpenseSplitterProps {
  /** Everyone in the group. */
  people: ExpenseSplitterPerson[]
  /** Controlled expenses. */
  expenses?: ExpenseSplitterExpense[]
  /** Starting expenses when uncontrolled. */
  defaultExpenses?: ExpenseSplitterExpense[]
  /** Called with the full list after an add or a removal. */
  onExpensesChange?: (expenses: ExpenseSplitterExpense[]) => void
  /** ISO 4217 code. Its minor-unit count decides how amounts are parsed. */
  currency?: string
  /** Locale for formatting. Defaults to the reader's. */
  locale?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Divides `amount` in proportion to `weights` so the parts sum to exactly
 * `amount`: everyone gets the floor of their share, and the minor units left
 * over go to the largest remainders, ties by order.
 */
export function splitExpenseSplitterAmount(amount: number, weights: number[]): number[] {
  // Weights like 33.3% become integers first, so the arithmetic below is exact.
  const places = Math.min(6, Math.max(0, ...weights.map((weight) => (String(weight).split('.')[1] ?? '').length)))
  const whole = weights.map((weight) => Math.round(weight * 10 ** places))
  const total = whole.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return weights.map(() => 0)
  const parts = whole.map((weight, index) => ({ index, floor: Math.floor((amount * weight) / total), remainder: (amount * weight) % total }))
  let left = amount - parts.reduce((sum, part) => sum + part.floor, 0)
  const out = parts.map((part) => part.floor)
  for (const part of [...parts].sort((a, b) => b.remainder - a.remainder || a.index - b.index)) {
    if (left <= 0) break
    out[part.index]! += 1
    left -= 1
  }
  return out
}

/** Each person's share of one expense, or an error when the split does not add up. */
export function expenseSplitterShares(expense: ExpenseSplitterExpense): { shares: Record<string, number>; error?: string } {
  const ids = Object.keys(expense.split).filter((id) => expense.mode === 'equal' || expense.split[id]! > 0)
  if (ids.length === 0) return { shares: {}, error: 'Choose at least one person to split with.' }
  if (expense.mode === 'exact') {
    const sum = ids.reduce((total, id) => total + expense.split[id]!, 0)
    if (sum !== expense.amount) return { shares: {}, error: `Exact amounts add up to ${sum}, not ${expense.amount}.` }
    return { shares: Object.fromEntries(ids.map((id) => [id, expense.split[id]!])) }
  }
  if (expense.mode === 'percent') {
    const sum = ids.reduce((total, id) => total + expense.split[id]!, 0)
    if (Math.abs(sum - 100) > 1e-9) return { shares: {}, error: `Percentages add up to ${sum}%, not 100%.` }
  }
  const weights = ids.map((id) => (expense.mode === 'equal' ? 1 : expense.split[id]!))
  const parts = splitExpenseSplitterAmount(expense.amount, weights)
  return { shares: Object.fromEntries(ids.map((id, i) => [id, parts[i]!])) }
}

/**
 * The fewest transfers the greedy method finds: pair exact opposites first,
 * then repeatedly settle the largest debt against the largest credit. At most
 * one fewer transfer than there are people with a balance.
 */
export function settleExpenseSplitter(balances: Record<string, number>): ExpenseSplitterTransfer[] {
  const debtors = Object.entries(balances).filter(([, v]) => v < 0).map(([id, v]) => ({ id, left: -v }))
  const creditors = Object.entries(balances).filter(([, v]) => v > 0).map(([id, v]) => ({ id, left: v }))
  const transfers: ExpenseSplitterTransfer[] = []
  for (const debtor of debtors) {
    const twin = creditors.find((creditor) => creditor.left === debtor.left && creditor.left > 0)
    if (twin) {
      transfers.push({ from: debtor.id, to: twin.id, amount: debtor.left })
      twin.left = 0
      debtor.left = 0
    }
  }
  for (;;) {
    const debtor = debtors.filter((d) => d.left > 0).sort((a, b) => b.left - a.left)[0]
    const creditor = creditors.filter((c) => c.left > 0).sort((a, b) => b.left - a.left)[0]
    if (!debtor || !creditor) break
    const amount = Math.min(debtor.left, creditor.left)
    transfers.push({ from: debtor.id, to: creditor.id, amount })
    debtor.left -= amount
    creditor.left -= amount
  }
  return transfers
}

const minorDigits = (currency: string) => new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2

/** "12.345" → 1235 cents is refused rather than rounded: money typed with too many decimals is a typo. */
const toMinor = (text: string, digits: number): number | null => {
  const clean = text.replace(/[\s,]/g, '')
  if (!new RegExp(`^\\d+(\\.\\d{0,${digits}})?$`).test(clean)) return null
  const [whole = '0', fraction = ''] = clean.split('.')
  return Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0') || 0)
}

/**
 * Splits shared costs and works out who pays whom.
 *
 * Money is kept in integer minor units from the moment it is typed, because
 * $10 split three ways in floating point is $3.3333… and the pennies go
 * missing. Every split — equal, by shares, by exact amounts, by percentages —
 * goes through one largest-remainder rounding, so each expense's parts sum to
 * the cent and the balances always net to zero. Settling pairs people who owe
 * exactly what someone else is owed first, then matches the biggest debtor with
 * the biggest creditor; the explanation says how many transfers that took.
 */
export function ExpenseSplitter({ people, expenses, defaultExpenses = [], onExpensesChange, currency = 'USD', locale, className }: ExpenseSplitterProps) {
  const uid = useId()
  const [own, setOwn] = useState(defaultExpenses)
  const list = expenses ?? own
  const digits = minorDigits(currency)
  const money = useMemo(() => new Intl.NumberFormat(locale, { style: 'currency', currency }), [locale, currency])
  const format = (minor: number) => money.format(minor / 10 ** digits)
  const nameOf = (id: string) => people.find((person) => person.id === id)?.name ?? id

  const [description, setDescription] = useState('')
  const [amountText, setAmountText] = useState('')
  const [paidBy, setPaidBy] = useState(people[0]?.id ?? '')
  const [mode, setMode] = useState<ExpenseSplitterMode>('equal')
  const [included, setIncluded] = useState<Record<string, boolean>>(() => Object.fromEntries(people.map((person) => [person.id, true])))
  const [weights, setWeights] = useState<Record<string, string>>({})

  const commit = (next: ExpenseSplitterExpense[]) => {
    if (expenses === undefined) setOwn(next)
    onExpensesChange?.(next)
  }

  const amount = toMinor(amountText, digits)
  const members = people.filter((person) => included[person.id])
  const weightOf = (id: string) => {
    const raw = weights[id] ?? ''
    if (mode === 'exact') return toMinor(raw || '0', digits) ?? NaN
    return raw === '' ? (mode === 'shares' ? 1 : 0) : Number(raw)
  }
  const draft: ExpenseSplitterExpense = {
    id: `draft`,
    description: description.trim(),
    amount: amount ?? 0,
    paidBy,
    mode,
    split: Object.fromEntries(members.map((person) => [person.id, mode === 'equal' ? 1 : weightOf(person.id)])),
  }
  const invalidWeight = members.some((person) => !Number.isFinite(draft.split[person.id]) || draft.split[person.id]! < 0)
  const preview = amount && !invalidWeight ? expenseSplitterShares(draft) : null
  const problem = !description.trim()
    ? 'Describe the expense.'
    : amount === null || amount === 0
      ? `Enter an amount with at most ${digits} decimal place${digits === 1 ? '' : 's'}.`
      : invalidWeight
        ? 'Each amount must be a positive number.'
        : preview?.error && mode === 'exact'
          ? `Exact amounts add up to ${format(members.reduce((sum, person) => sum + draft.split[person.id]!, 0))} of ${format(amount)}.`
          : preview?.error

  const add = (event: FormEvent) => {
    event.preventDefault()
    if (problem) return
    commit([...list, { ...draft, id: `${Date.now().toString(36)}-${list.length}` }])
    setDescription('')
    setAmountText('')
    setWeights({})
  }

  const balances: Record<string, number> = Object.fromEntries(people.map((person) => [person.id, 0]))
  for (const expense of list) {
    const { shares, error } = expenseSplitterShares(expense)
    if (error) continue
    balances[expense.paidBy] = (balances[expense.paidBy] ?? 0) + expense.amount
    for (const [id, share] of Object.entries(shares)) balances[id] = (balances[id] ?? 0) - share
  }
  const transfers = settleExpenseSplitter(balances)
  const unsettled = Object.values(balances).filter((value) => value !== 0).length
  const total = list.reduce((sum, expense) => sum + expense.amount, 0)
  const widest = Math.max(1, ...Object.values(balances).map(Math.abs))

  return (
    <div className={cn('grid w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]', className)}>
      <div className="flex min-w-0 flex-col gap-4">
        <form onSubmit={add} role="group" aria-label="Add an expense" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Input aria-label="Description" placeholder="What was it for?" value={description} onChange={(event) => setDescription(event.target.value)} />
            <Input aria-label={`Amount in ${currency}`} inputMode="decimal" placeholder="0.00" value={amountText} onChange={(event) => setAmountText(event.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Text as="span" size="label" tone="soft">
              Paid by
            </Text>
            <Select label="Paid by" size="sm" value={paidBy} onValueChange={setPaidBy} options={people.map((person) => ({ value: person.id, label: person.name }))} />
            <SegmentedControl
              label="Split"
              size="sm"
              value={mode}
              onValueChange={(next) => {
                setMode(next)
                setWeights({})
              }}
              options={[
                { value: 'equal', label: 'Equally' },
                { value: 'shares', label: 'Shares' },
                { value: 'exact', label: 'Exact' },
                { value: 'percent', label: '%' },
              ]}
            />
          </div>
          <ul className="flex flex-col gap-1.5">
            {people.map((person) => {
              const share = preview?.shares[person.id]
              return (
                <li key={person.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`${uid}-${person.id}`}
                    boxSize="sm"
                    checked={Boolean(included[person.id])}
                    onChange={(event) => setIncluded((current) => ({ ...current, [person.id]: event.target.checked }))}
                  />
                  <label htmlFor={`${uid}-${person.id}`} className="flex-1 text-[13px] font-semibold text-ink">
                    {person.name}
                  </label>
                  {mode !== 'equal' && included[person.id] && (
                    <Input
                      aria-label={`${person.name}: ${mode === 'shares' ? 'shares' : mode === 'exact' ? `amount in ${currency}` : 'percent'}`}
                      inputSize="sm"
                      inputMode="decimal"
                      placeholder={mode === 'shares' ? '1' : mode === 'exact' ? '0.00' : '0'}
                      value={weights[person.id] ?? ''}
                      onChange={(event) => setWeights((current) => ({ ...current, [person.id]: event.target.value }))}
                      containerClassName="w-24"
                    />
                  )}
                  <Text as="span" size="label" weight="bold" tabular className="w-20 text-right">
                    {share !== undefined ? format(share) : '—'}
                  </Text>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Text size="caption" tone={problem && (description || amountText) ? 'danger' : 'faint'} aria-live="polite">
              {problem ?? `Shares add up to ${format(Object.values(preview?.shares ?? {}).reduce((a, b) => a + b, 0))} exactly.`}
            </Text>
            <Button size="sm" type="submit" disabled={Boolean(problem)}>
              Add expense
            </Button>
          </div>
        </form>

        <div role="group" aria-label="Expenses" className="flex flex-col gap-2">
          <Text size="label" weight="bold">
            {list.length} expense{list.length === 1 ? '' : 's'} · {format(total)}
          </Text>
          <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-tile)] border border-line">
            {list.map((expense) => (
              <li key={expense.id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <Text size="body" truncate>
                    {expense.description}
                  </Text>
                  <Text size="caption" tone="faint">
                    {nameOf(expense.paidBy)} paid · split {expense.mode === 'equal' ? 'equally' : `by ${expense.mode === 'percent' ? 'percentage' : expense.mode}`} between{' '}
                    {Object.keys(expenseSplitterShares(expense).shares).map(nameOf).join(', ')}
                  </Text>
                </div>
                <Text as="span" size="label" weight="bold" tabular>
                  {format(expense.amount)}
                </Text>
                <IconButton icon={CrossIcon} size="xs" label={`Remove ${expense.description}`} onClick={() => commit(list.filter((item) => item.id !== expense.id))} />
              </li>
            ))}
            {list.length === 0 && (
              <li className="px-3 py-3">
                <Text size="caption" tone="faint">
                  No expenses yet.
                </Text>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div role="group" aria-label="Balances" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <Text size="label" weight="bold">
            Balances
          </Text>
          <ul className="flex flex-col gap-2">
            {people.map((person) => {
              const balance = balances[person.id] ?? 0
              return (
                <li key={person.id} className="grid grid-cols-[80px_minmax(0,1fr)_90px] items-center gap-2">
                  <Text as="span" size="label" weight="semibold" truncate>
                    {person.name}
                  </Text>
                  <span aria-hidden="true" className="relative h-2 rounded-full bg-track">
                    <span
                      className={cn('absolute top-0 h-full rounded-full', balance >= 0 ? 'left-1/2 bg-success' : 'right-1/2 bg-danger')}
                      style={{ width: `${(Math.abs(balance) / widest) * 50}%` }}
                    />
                  </span>
                  <Text as="span" size="label" weight="bold" tabular tone={balance > 0 ? 'success' : balance < 0 ? 'danger' : 'faint'} className="text-right">
                    {balance > 0 ? `gets ${format(balance)}` : balance < 0 ? `owes ${format(-balance)}` : 'settled'}
                  </Text>
                </li>
              )
            })}
          </ul>
        </div>

        <div role="group" aria-label="Settle up" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <Text size="label" weight="bold">
            Settle up
          </Text>
          {transfers.length === 0 ? (
            <Text size="caption" tone="faint">
              Everyone is square.
            </Text>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {transfers.map((transfer, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-[var(--radius-tile)] bg-surface-sunken px-3 py-2">
                  <Text as="span" size="label">
                    <strong className="font-bold">{nameOf(transfer.from)}</strong> pays <strong className="font-bold">{nameOf(transfer.to)}</strong>
                  </Text>
                  <Text as="span" size="label" weight="bold" tabular>
                    {format(transfer.amount)}
                  </Text>
                </li>
              ))}
            </ol>
          )}
          {transfers.length > 0 && (
            <Text size="caption" tone="soft" leading="normal">
              {unsettled} people have a balance, so any plan needs at most {unsettled - 1} transfers. This one uses {transfers.length}: people who owe exactly what someone is owed pay them directly, then the largest debt is settled against the largest credit until nothing is left.
            </Text>
          )}
        </div>
      </div>
    </div>
  )
}
