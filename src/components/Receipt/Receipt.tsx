import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface ReceiptLineItem {
  /** Stable key. Defaults to the position. */
  id?: string
  /** What was bought. */
  description: string
  /** Second line: a variant, a period, a SKU. */
  detail?: string
  quantity: number
  /** Price of one, in major units. */
  unitPrice: number
}

export interface ReceiptAdjustment {
  /** Such as “WELCOME10” or “Loyalty credit”. */
  label: string
  /** A positive amount, taken off the subtotal. */
  amount: number
}

export interface ReceiptTax {
  /** Such as “VAT” or “Sales tax”. */
  label: string
  /** Rate as a fraction, 0.2 for 20%. Applied after discounts when no amount is given. */
  rate?: number
  /** The tax charged, when it was worked out elsewhere. Wins over rate. */
  amount?: number
}

export interface ReceiptPayment {
  /** Such as “Visa” or “Apple Pay”. */
  method: string
  /** Last four digits of the card, shown masked. */
  last4?: string
  /** Such as “Paid” or “Refunded”. */
  status?: string
}

export interface ReceiptProps {
  /** Who was paid. */
  merchant: { name: string; address?: string; logo?: ReactNode }
  /** Receipt or order number, shown as given. */
  number: string
  /** When the payment was taken. */
  date: Date | string
  items: ReceiptLineItem[]
  discounts?: ReceiptAdjustment[]
  /** Delivery charge, before tax. */
  shipping?: number
  tax?: ReceiptTax
  payment?: ReceiptPayment
  /** ISO 4217 code for every amount. */
  currency?: string
  /** BCP 47 locale for amounts and the date. Defaults to the reader’s. */
  locale?: string
  /** Buttons such as Print or Download PDF. Hidden when printed. */
  actions?: ReactNode
  /** A closing line: returns policy, a thank-you, a support address. */
  footer?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A receipt that works on screen and on paper from the same markup.
 *
 * Every figure is derived from the line items, the discounts, shipping and tax
 * — the caller does not pass a total — so the column always adds up. Tax is
 * charged on what was actually paid for, after discounts, which is how most tax
 * authorities want it; pass `amount` when the rules are more involved.
 *
 * Line items are a real table with a caption, so a screen reader can move along
 * a row and hear “Qty 2”. Printing drops the actions, the shadow and the theme:
 * a dark-mode reader who prints gets black text on white rather than a page of
 * pale grey ink.
 */
export function Receipt({
  merchant,
  number,
  date,
  items,
  discounts = [],
  shipping,
  tax,
  payment,
  currency = 'USD',
  locale,
  actions,
  footer,
  className,
}: ReceiptProps) {
  const money = (amount: number) => amount.toLocaleString(locale, { style: 'currency', currency })
  const when = typeof date === 'string' ? new Date(date) : date

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const discounted = discounts.reduce((sum, discount) => sum + discount.amount, 0)
  const taxable = Math.max(0, subtotal - discounted + (shipping ?? 0))
  const taxAmount = tax ? (tax.amount ?? Math.round(taxable * (tax.rate ?? 0) * 100) / 100) : 0
  const total = taxable + taxAmount

  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: 'Subtotal', value: money(subtotal) },
    ...discounts.map((discount) => ({ label: discount.label, value: `−${money(discount.amount)}` })),
    ...(shipping !== undefined ? [{ label: 'Shipping', value: shipping === 0 ? 'Free' : money(shipping) }] : []),
    ...(tax
      ? [{ label: tax.rate !== undefined && tax.amount === undefined ? `${tax.label} (${+(tax.rate * 100).toFixed(2)}%)` : tax.label, value: money(taxAmount) }]
      : []),
    { label: 'Total', value: money(total), strong: true },
  ]

  return (
    <article
      aria-label={`Receipt ${number} from ${merchant.name}`}
      className={cn(
        'flex w-full max-w-[420px] flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-6 text-ink shadow-[var(--shadow-card)]',
        'print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black print:shadow-none',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {merchant.logo}
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[15px] font-bold leading-none">{merchant.name}</p>
            {merchant.address && <p className="text-[12px] font-medium text-ink-faint print:text-black">{merchant.address}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 gap-2 print:hidden">{actions}</div>}
      </header>

      <dl className="grid grid-cols-2 gap-3 border-y border-dashed border-line-strong py-3 text-[12px]">
        <div className="flex flex-col gap-1">
          <dt className="font-medium text-ink-faint print:text-black">Receipt no.</dt>
          <dd className="font-bold tabular-nums">{number}</dd>
        </div>
        <div className="flex flex-col gap-1 text-right">
          <dt className="font-medium text-ink-faint print:text-black">Date</dt>
          <dd className="font-bold">
            <time dateTime={when.toISOString()}>
              {when.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
            </time>
          </dd>
        </div>
      </dl>

      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">Items</caption>
        <thead>
          <tr className="text-[11px] font-bold uppercase tracking-wider text-ink-faint print:text-black">
            <th scope="col" className="pb-2 text-left font-bold">Item</th>
            <th scope="col" className="pb-2 text-right font-bold">Qty</th>
            <th scope="col" className="pb-2 text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id ?? index} className="border-t border-line align-top print:break-inside-avoid">
              <td className="py-2.5 pr-3">
                <span className="block font-semibold">{item.description}</span>
                <span className="block text-[12px] font-medium text-ink-faint print:text-black">
                  {item.detail ? `${item.detail} · ` : ''}
                  {money(item.unitPrice)} each
                </span>
              </td>
              <td className="py-2.5 text-right font-medium tabular-nums">{item.quantity}</td>
              <td className="py-2.5 pl-3 text-right font-semibold tabular-nums">{money(item.quantity * item.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="flex flex-col gap-2 border-t border-line pt-3 text-[13px]">
        {rows.map((row) => (
          <div
            key={row.label}
            className={cn('flex justify-between gap-4', row.strong && 'mt-1 border-t border-dashed border-line-strong pt-3 text-[16px]')}
          >
            <dt className={row.strong ? 'font-bold' : 'font-medium text-ink-soft print:text-black'}>{row.label}</dt>
            <dd className={cn('tabular-nums', row.strong ? 'font-extrabold' : 'font-semibold')}>{row.value}</dd>
          </div>
        ))}
      </dl>

      {payment && (
        <p className="flex items-center justify-between gap-3 rounded-[var(--radius-glyph)] bg-surface-sunken px-3 py-2.5 text-[12px] font-medium print:border print:border-black print:bg-white">
          <span>
            {payment.method}
            {payment.last4 && <span className="tabular-nums"> ending {payment.last4}</span>}
          </span>
          {payment.status && <span className="font-bold">{payment.status}</span>}
        </p>
      )}

      {footer && <footer className="text-center text-[12px] font-medium text-ink-faint print:text-black">{footer}</footer>}
    </article>
  )
}
