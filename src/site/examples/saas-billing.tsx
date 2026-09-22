import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import {
  Button,
  CheckoutSummary,
  InvoiceList,
  PaymentMethodCard,
  PlanSummary,
  SegmentedControl,
  Text,
  UpgradePrompt,
  UsageMeter,
  type Invoice,
  type SubscriptionStatus,
} from 'klyvui'
import type { ExampleModule } from './types'
import { rationale } from './shared'
import { INVOICES, USAGE, daysFromNow } from './saas-shared'

function PlanExample() {
  const [status, setStatus] = useState<SubscriptionStatus>('active')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Status"
        size="sm"
        value={status}
        onValueChange={setStatus}
        className="self-start"
        options={[
          { value: 'active', label: 'Active' },
          { value: 'trialing', label: 'Trial' },
          { value: 'past_due', label: 'Past due' },
          { value: 'canceled', label: 'Canceled' },
          { value: 'paused', label: 'Paused' },
        ]}
      />
      <PlanSummary
        plan="Team"
        price="$468"
        period="per month · 12 seats"
        status={status}
        renewsAt={daysFromNow(19)}
        trialEndsAt={daysFromNow(3)}
        endsAt={daysFromNow(19)}
        seats={{ used: 11, total: 12 }}
        details={[
          { term: 'Billing email', description: 'finance@northwind.io' },
          { term: 'Payment method', description: 'Visa ending in 4242' },
        ]}
        paymentAction={<Button size="sm">Update payment method</Button>}
        actions={
          <>
            <Button size="sm">Change plan</Button>
            <Button size="sm" variant="outline">
              Manage seats
            </Button>
            <Button size="sm" variant="ghost">
              {status === 'canceled' ? 'Resume subscription' : 'Cancel plan'}
            </Button>
          </>
        }
      />
    </div>
  )
}

function InvoiceExample() {
  const [invoices, setInvoices] = useState<Invoice[]>(INVOICES)
  const [last, setLast] = useState<string>()
  return (
    <div className="flex w-full flex-col gap-3">
      <InvoiceList
        invoices={invoices}
        onPay={(invoice) => {
          setInvoices((current) => current.map((item) => (item.id === invoice.id ? { ...item, status: 'paid' } : item)))
          setLast(`Paid ${invoice.number}`)
        }}
        onDownload={(invoice) => setLast(`Downloading ${invoice.number}.pdf`)}
      />
      <Text size="caption" tone="faint" aria-live="polite">
        {last ?? 'The failed invoice carries its own Pay now.'}
      </Text>
    </div>
  )
}

export const demos: ExampleModule = {
  'plan-summary': {
    description:
      'The top of a billing page: which plan, what state it is in, and the one date that matters next — stated as a sentence, not a field called “Period end”.',
    sections: [
      { title: 'Every status', bare: true, Content: PlanExample },
      rationale(
        'Billing screens show a status badge and leave the reader to work out what happens next; a failed payment is the same size badge as “Active”.',
        'Each status has exactly one important date; a trial within three days turns urgent, and past due becomes a warning with the fix inside it.',
        'Billing settings, the account overview, an admin customer page.',
        ['Surface', 'Tag', 'StatusDot', 'Alert', 'Progress', 'DescriptionList'],
      ),
    ],
    props: [
      { name: 'plan / price / period', type: 'string', description: 'What the account is on.' },
      { name: 'status', type: "'active' | 'trialing' | 'past_due' | 'canceled' | 'paused'", description: 'Drives the pill and the sentence.' },
      { name: 'renewsAt / trialEndsAt / endsAt', type: 'Date', description: 'The date for each status.' },
      { name: 'seats', type: '{ used, total }', description: 'Seat bar.' },
      { name: 'details / actions / paymentAction', type: 'DescriptionItem[] / ReactNode', description: 'Extra rows, the footer, and the fix for a failed payment.' },
    ],
  },

  'usage-meter': {
    description:
      'Plan entitlements against this billing period — events, seats, storage, projects. Unlimited rows have no bar, and over the limit is its own state, not a bar at 100%.',
    sections: [
      {
        title: 'Example',
        bare: true,
        Content: () => <UsageMeter items={USAGE} period="Resets on 1 Oct" onUpgrade={() => undefined} layout="grid" />,
      },
      rationale(
        'RateLimitMeter is the rolling window — calls per hour. The other quota every SaaS has is counted over a billing period, with some items unlimited and some already billed as overage.',
        'The footer only appears when something is close to its limit, naming it; figures past 100k compact to 1.2M because the digits stop being read.',
        'Billing and plan pages, the admin overview, a usage popover.',
        ['Surface', 'Tag', 'Button', 'status tokens'],
      ),
    ],
    props: [
      { name: 'items', type: 'UsageItem[]', description: '{ id, label, used, limit (null = unlimited), unit?, format?, hint? }.' },
      { name: 'period', type: 'ReactNode', description: 'When the counts reset.' },
      { name: 'warnAt', type: 'number', defaultValue: '0.8', description: 'Fraction at which a row warns.' },
      { name: 'onUpgrade / upgradeLabel', type: 'fn / string', description: 'Offered only when something is pressing.' },
      { name: 'layout', type: "'list' | 'grid'", defaultValue: 'list', description: 'Two columns from sm.' },
    ],
  },

  'upgrade-prompt': {
    description:
      'An upsell that says what it unlocks, placed where it is needed: across the top of the app, as a panel, or inline where a gated feature would sit. Trial days are derived from a date.',
    sections: [
      {
        title: 'Placements',
        stack: true,
        specimens: [
          {
            label: 'banner, with a trial',
            fill: true,
            node: <UpgradePrompt variant="banner" title="Your Pro trial is running." description="Add a card to keep workflows after it ends." trialEndsAt={daysFromNow(5)} action={<Button size="sm" variant="white">Add payment method</Button>} onDismiss={() => undefined} className="w-full" />,
          },
          {
            label: 'card',
            fill: true,
            node: (
              <UpgradePrompt
                className="w-full max-w-[420px]"
                icon={Sparkles}
                plan="Pro"
                title="Automate the follow-up"
                description="Workflows act on your metrics the moment they cross a line."
                benefits={['Unlimited workflows', 'Slack and webhook actions', '1M events a month']}
                action={<Button size="sm">Upgrade to Pro</Button>}
                secondaryAction={<Button size="sm" variant="ghost">Compare plans</Button>}
                onDismiss={() => undefined}
              />
            ),
          },
          {
            label: 'inline, where the feature would be',
            fill: true,
            node: <UpgradePrompt variant="inline" plan="Team" title="Audit log" description="See who changed what, and when. Available on Team." action={<Button size="sm" variant="outline">Upgrade</Button>} className="w-full" />,
          },
        ],
      },
      rationale(
        'Upsells are either a modal that interrupts or a generic “Upgrade” that never says what for — and trial banners cached as text go on saying “3 days left”.',
        'Three placements for the three moments an upgrade is asked for; dismissible where it repeats, because nagging that cannot be closed becomes invisible.',
        'App-wide trial banner, billing overview, a locked settings section, an empty chart.',
        ['Surface', 'Badge', 'IconTile', 'Text'],
      ),
    ],
    props: [
      { name: 'variant', type: "'card' | 'banner' | 'inline'", defaultValue: 'card', description: 'Placement.' },
      { name: 'title / description / benefits', type: 'string / ReactNode / string[]', description: 'What is being unlocked.' },
      { name: 'plan / icon', type: 'string / IconComponent', description: 'The plan badge and a glyph.' },
      { name: 'action / secondaryAction', type: 'ReactNode', description: 'The asks.' },
      { name: 'trialEndsAt', type: 'Date', description: 'Shows the days left, worked out on render.' },
      { name: 'onDismiss', type: '() => void', description: 'Adds a close control.' },
    ],
  },

  'invoice-list': {
    description:
      'Billing history: every invoice, its state and the PDF. A due or failed invoice carries its own Pay now in the row — it is the only row anyone came here for.',
    sections: [
      { title: 'Example', bare: true, Content: InvoiceExample },
      {
        title: 'Empty',
        bare: true,
        Content: () => <InvoiceList invoices={[]} />,
      },
      rationale(
        'Invoice tables send people elsewhere to pay an overdue invoice and label every download “PDF”.',
        'Each action carries its invoice number for assistive tech; status is a dot and a word, never colour alone.',
        'Billing settings, an admin customer page.',
        ['Table', 'Button', 'Tag', 'StatusDot', 'EmptyState'],
      ),
    ],
    props: [
      { name: 'invoices', type: 'Invoice[]', description: "{ id, number, date, amount, status: 'paid' | 'open' | 'failed' | 'void' | 'refunded', description? }." },
      { name: 'onPay', type: '(invoice) => void', description: 'Offered on due and failed invoices.' },
      { name: 'onDownload', type: '(invoice) => void', description: 'The PDF.' },
      { name: 'emptyMessage', type: 'ReactNode', description: 'Before the first payment.' },
    ],
  },

  'payment-method-card': {
    description:
      'A saved card: which one, whether it still works, and what can be done with it. Expiry is worked out against the last day of the month, and the default card cannot be removed out from under a subscription.',
    sections: [
      {
        title: 'States',
        stack: true,
        specimens: [
          { label: 'default', fill: true, node: <PaymentMethodCard brand="visa" last4="4242" expMonth={8} expYear={2029} holder="Alex Morgan" isDefault onEdit={() => undefined} onRemove={() => undefined} className="w-full" /> },
          { label: 'expiring soon', fill: true, node: <PaymentMethodCard brand="mastercard" last4="5100" expMonth={new Date().getMonth() + 2} expYear={new Date().getFullYear()} onMakeDefault={() => undefined} onEdit={() => undefined} onRemove={() => undefined} className="w-full" /> },
          { label: 'expired', fill: true, node: <PaymentMethodCard brand="amex" last4="0005" expMonth={1} expYear={2025} onEdit={() => undefined} onRemove={() => undefined} className="w-full" /> },
        ],
      },
      rationale(
        'An expired card is the most common cause of a failed renewal, and it is usually displayed as a plain “08/25” until the renewal fails.',
        'Within sixty days it says “Expires soon” and promotes Edit; once expired it offers Replace and cannot become the default.',
        'Billing settings, checkout, a plan-change dialog.',
        ['Surface', 'Tag', 'Button', 'Text'],
      ),
    ],
    props: [
      { name: 'brand / last4', type: 'string', description: 'Network (drawn as a text mark) and last four digits.' },
      { name: 'expMonth / expYear', type: 'number', description: 'Valid through the end of that month.' },
      { name: 'isDefault', type: 'boolean', description: 'Disables Remove.' },
      { name: 'onMakeDefault / onEdit / onRemove', type: '() => void', description: 'Row actions.' },
      { name: 'warnDays', type: 'number', defaultValue: '60', description: 'Warning window before expiry.' },
    ],
  },

  'checkout-summary': {
    description:
      'The order summary beside a checkout: lines, a promo code, tax, what is due today — and what will be charged after today, the line that decides whether next month is a surprise.',
    sections: [
      {
        title: 'Upgrading mid-cycle',
        description: 'Try the code LAUNCH20, then anything else.',
        bare: true,
        Content: CheckoutExample,
      },
      rationale(
        'Checkouts show a total and hide the recurring charge, and promo errors appear as a toast after the button is pressed.',
        'Credits and prorations are just negative lines; the discount never takes the total below zero. Card entry is deliberately left to the provider’s hosted field in the children slot.',
        'Upgrade and plan-change dialogs, seat purchases, the checkout page.',
        ['Surface', 'Input', 'Button', 'InlineMessage'],
      ),
    ],
    props: [
      { name: 'lines', type: 'CheckoutLine[]', description: '{ id, label, description?, amount } — negative for credits.' },
      { name: 'taxRate / taxLabel', type: 'number / string', description: 'Applied after discounts.' },
      { name: 'onApplyPromo', type: '(code) => Promise<AppliedPromo | string>', description: 'Resolve a promo, or an error message.' },
      { name: 'recurring', type: 'ReactNode', description: 'What is charged after today.' },
      { name: 'children / action / note', type: 'ReactNode', description: 'The provider’s card field, the Pay button, small print.' },
    ],
  },
}

function CheckoutExample() {
  const [paid, setPaid] = useState(false)
  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <CheckoutSummary
        lines={[
          { id: 'plan', label: 'Team plan', description: '12 seats · billed monthly', amount: 588 },
          { id: 'credit', label: 'Unused time on Pro', description: '19 days, prorated', amount: -61.2 },
        ]}
        taxRate={0.2}
        taxLabel="VAT"
        onApplyPromo={async (code) => {
          await new Promise((resolve) => window.setTimeout(resolve, 500))
          return code === 'LAUNCH20' ? { code, label: '20% off the first month', amount: 105.36 } : 'That code is not valid for this plan.'
        }}
        recurring={`Then $705.60 a month including VAT, from ${daysFromNow(19).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}. Cancel any time.`}
        action={<Button onClick={() => setPaid(true)}>{paid ? 'Paid — thank you' : 'Pay and upgrade'}</Button>}
        note="Payments are processed by your payment provider. We never see your card number."
      >
        <div className="flex h-11 items-center rounded-[var(--radius-field)] border border-dashed border-line-strong px-4 text-[12px] font-semibold text-ink-faint">
          Payment provider’s card field mounts here
        </div>
      </CheckoutSummary>
    </div>
  )
}
