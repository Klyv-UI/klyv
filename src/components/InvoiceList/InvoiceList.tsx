'use client'

import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { type StatusDotTone } from '../StatusDot'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { EmptyState } from '../EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../Table'
import { StatusPill } from '../internal/StatusPill'
import { formatDate } from '../../lib/format'

export type InvoiceStatus = 'paid' | 'open' | 'failed' | 'void' | 'refunded'

const STATUS: Record<InvoiceStatus, { label: string; tone: StatusDotTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  open: { label: 'Due', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
  void: { label: 'Void', tone: 'neutral' },
  refunded: { label: 'Refunded', tone: 'neutral' },
}

export interface Invoice {
  id: string
  /** The number printed on the invoice — "INV-2026-0142". */
  number: string
  date: Date
  /** Already formatted, in the invoice currency. */
  amount: string
  status: InvoiceStatus
  /** "Pro plan · 12 seats". */
  description?: string
}

export interface InvoiceListProps {
  invoices: Invoice[]
  label?: string
  onDownload?: (invoice: Invoice) => void
  /** Offered on due and failed invoices. */
  onPay?: (invoice: Invoice) => void
  emptyMessage?: ReactNode
  className?: string
}

/**
 * Billing history: every invoice, its state, and the PDF.
 *
 * An unpaid invoice is the only row anyone came here for, so a due or failed
 * invoice carries its own "Pay now" in the row rather than sending people to a
 * separate screen to find it. Each download is named for its invoice — a column
 * of buttons all called "PDF" is useless in a links list.
 */
export function InvoiceList({
  invoices,
  label = 'Invoices',
  onDownload,
  onPay,
  emptyMessage = 'Invoices appear here after your first payment.',
  className,
}: InvoiceListProps) {
  if (invoices.length === 0) {
    return <EmptyState size="sm" title="No invoices yet" description={emptyMessage} className={className} />
  }

  return (
    <div className={cn('w-full', className)}>
      <Table label={label} className="min-w-[560px]">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Invoice</TableHeaderCell>
            <TableHeaderCell>Date</TableHeaderCell>
            <TableHeaderCell align="right">Amount</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right">
              <VisuallyHidden>Actions</VisuallyHidden>
            </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoices.map((invoice) => {
            const status = STATUS[invoice.status]
            const payable = onPay && (invoice.status === 'open' || invoice.status === 'failed')
            return (
              <TableRow key={invoice.id}>
                <TableCell>
                  <span className="flex flex-col gap-1">
                    <span className="font-bold">{invoice.number}</span>
                    {invoice.description && (
                      <Text as="span" size="caption" tone="faint">
                        {invoice.description}
                      </Text>
                    )}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-ink-soft">{formatDate(invoice.date)}</TableCell>
                <TableCell align="right" tabular className="font-bold">
                  {invoice.amount}
                </TableCell>
                <TableCell>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </TableCell>
                <TableCell align="right">
                  <span className="inline-flex items-center gap-1">
                    {payable && (
                      <Button size="sm" onClick={() => onPay(invoice)}>
                        Pay now
                        <VisuallyHidden> {invoice.number}</VisuallyHidden>
                      </Button>
                    )}
                    {onDownload && (
                      <Button size="sm" variant="ghost" onClick={() => onDownload(invoice)}>
                        PDF
                        <VisuallyHidden> for {invoice.number}</VisuallyHidden>
                      </Button>
                    )}
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
