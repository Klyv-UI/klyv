/**
 * Formatting shared by the SaaS kit.
 *
 * Billing and usage screens are where a product's numbers are read most
 * carefully, so these live in one place: a plan renewing on "1 Oct 2026" in the
 * summary and "10/1/26" in the invoice list is the kind of inconsistency that
 * makes people check their bank statement.
 */

const DAY = 86_400_000

/** "1 Oct 2026", or "1 Oct" when the year is obvious from context. */
export function formatDate(date: Date, withYear = true): string {
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

/**
 * Whole days until a moment, rounded up — a trial ending in 30 hours has two
 * days left, not one, because tomorrow it will still be running.
 */
export function daysUntil(date: Date, now: number = Date.now()): number {
  return Math.ceil((date.getTime() - now) / DAY)
}

/** "1 seat", "3 seats". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`
}

/** 12,480 stays exact; 1,284,000 becomes 1.3M, where the digits stop being read. */
export function formatQuantity(value: number): string {
  if (Math.abs(value) < 100_000) return value.toLocaleString()
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
}

/** A price with no trailing ".00" — $49, but $4.99. */
export function formatPrice(amount: number, currency = '$'): string {
  const digits = Number.isInteger(amount) ? 0 : 2
  return `${currency}${amount.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
