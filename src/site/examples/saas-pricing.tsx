import { useState } from 'react'
import {
  BillingToggle,
  Button,
  FeatureComparison,
  PricingCard,
  PricingTable,
  Text,
  type BillingPeriod,
} from 'klyvui'
import type { ExampleModule } from './types'
import { rationale } from './shared'
import { COMPARISON_GROUPS, COMPARISON_PLANS, PLANS } from './saas-shared'

function ToggleExample() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly')
  return (
    <div className="flex flex-col items-start gap-3">
      <BillingToggle value={period} onValueChange={setPeriod} savings="Save 20%" />
      <Text size="caption" tone="faint">
        Selected: {period}
      </Text>
    </div>
  )
}

function TableExample() {
  const [chosen, setChosen] = useState<string>()
  return (
    <div className="flex w-full flex-col gap-3">
      <PricingTable plans={PLANS} currentPlanId="free" onSelect={(id, period) => setChosen(`${id} · ${period}`)} />
      <Text size="caption" tone="faint" aria-live="polite">
        {chosen ? `Chose ${chosen}` : 'The Free plan is marked as current. The saving on the toggle is computed from the plans.'}
      </Text>
    </div>
  )
}

export const demos: ExampleModule = {
  'billing-toggle': {
    description:
      'Monthly or yearly, above every pricing table. The saving sits beside the control rather than inside it — inside, it changes one segment’s width and the track jumps as prices load.',
    sections: [
      { title: 'Example', Content: ToggleExample },
      rationale(
        'Period switches get rebuilt as ad-hoc toggles with a badge crammed into one side, which shifts layout and reads as one run-on label.',
        'It is a SegmentedControl, so keyboard and semantics come for free; the saving badge turns accent when yearly is chosen.',
        'Pricing pages, plan-change dialogs, checkout.',
        ['SegmentedControl', 'Badge'],
      ),
    ],
    props: [
      { name: 'value / onValueChange', type: "'monthly' | 'yearly' / fn", description: 'Controlled period.' },
      { name: 'savings', type: 'string', description: 'The reason to switch.' },
      { name: 'monthlyLabel / yearlyLabel', type: 'string', description: 'Segment labels.' },
    ],
  },

  'pricing-card': {
    description:
      'One plan: name, price, the action directly under the price, then what you get. Pricing pages are scanned price-to-button, so the buttons line up across cards.',
    sections: [
      {
        title: 'States',
        bare: true,
        Content: () => (
          <div className="grid gap-4 pt-3 md:grid-cols-3">
            <PricingCard name="Starter" description="For one person." price={0} priceCaption="Free forever" action={<Button variant="outline">Start for free</Button>} features={['3 projects', { label: 'Workflows', included: false }, { label: 'SSO', included: false }]} current />
            <PricingCard name="Pro" description="For small teams." price={19} compareAt={24} priceCaption="Billed $228 yearly" featured badge="Most popular" action={<Button>Upgrade to Pro</Button>} featuresTitle="Everything in Starter, plus" features={['Unlimited projects', { label: 'Workflows', hint: 'Up to 50 active' }, { label: 'SSO', included: false }]} />
            <PricingCard name="Enterprise" description="For organisations." price={null} customLabel="Let’s talk" priceCaption="Volume pricing and invoicing" action={<Button variant="outline">Contact sales</Button>} features={['Everything in Pro', 'SSO and SCIM', 'Custom contract']} />
          </div>
        ),
      },
      rationale(
        'Pricing cards bury the button under the feature list, so the recommended plan’s button ends up lowest on the page — and excluded features are struck through visually but read aloud as included.',
        'Excluded rows are announced as “Not included”; a discount shows the old price struck through with “Was” for assistive tech.',
        'Pricing pages, upgrade dialogs, plan pickers in onboarding.',
        ['Surface', 'Badge', 'Tag', 'Text'],
      ),
    ],
    props: [
      { name: 'price', type: 'number | null', description: 'null is a custom plan.' },
      { name: 'compareAt / priceCaption', type: 'number / ReactNode', description: 'Struck-through price and the line under it.' },
      { name: 'features', type: '(string | PricingFeature)[]', description: 'included: false for a struck row; hint for a note.' },
      { name: 'action', type: 'ReactNode', description: 'Stretched to the card width.' },
      { name: 'featured / badge / current', type: 'boolean / string / boolean', description: 'Recommended, its pill, and the plan you are on.' },
    ],
  },

  'pricing-table': {
    description:
      'Plans behind a monthly/yearly switch. The saving is computed from the plans rather than typed in, and yearly prices show the annual total that actually leaves the account.',
    sections: [
      { title: 'Example', bare: true, Content: TableExample },
      rationale(
        '“Save 20%” written into the marketing copy in March is wrong by June, and a per-month yearly price with no annual total is how a refund request starts.',
        'Switching period is announced once — every figure on the table just changed, and nothing else tells a screen reader user that it did.',
        'Public pricing page, the in-app “Change plan” screen.',
        ['BillingToggle', 'PricingCard', 'Button'],
      ),
    ],
    props: [
      { name: 'plans', type: 'PricingPlan[]', description: '{ id, name, monthly, yearly, features, featured?, badge?, ctaLabel? } — prices per month.' },
      { name: 'period / defaultPeriod / onPeriodChange', type: 'BillingPeriod / fn', description: 'Controlled or uncontrolled.' },
      { name: 'onSelect', type: '(planId, period) => void', description: 'A plan’s button was pressed.' },
      { name: 'currentPlanId', type: 'string', description: 'Becomes a disabled “Current plan”.' },
      { name: 'currency / unit', type: 'string', defaultValue: "'$' / '/month'", description: 'Formatting.' },
    ],
  },

  'feature-comparison': {
    description:
      'The full plan-by-feature matrix. A real table with row and group headers — and below sm, one plan at a time from a segmented control, because a sideways-scrolling matrix loses the question being asked.',
    sections: [
      {
        title: 'Example',
        description: 'Narrow the window below 640px to see the one-plan view.',
        bare: true,
        Content: () => (
          <FeatureComparison
            label="Compare plans"
            plans={COMPARISON_PLANS.map((plan) => ({ ...plan, action: <Button size="sm" variant={plan.highlight ? 'accent' : 'outline'}>{plan.id === 'enterprise' ? 'Contact' : 'Choose'}</Button> }))}
            groups={COMPARISON_GROUPS}
          />
        ),
      },
      rationale(
        'Comparison grids built from divs cannot answer “what does Team get for SSO?” for anyone not seeing the grid.',
        'Ticks and dashes carry “Included” and “Not included” as text; the recommended column is tinted with accent-soft.',
        'Under the pricing cards; a “Compare plans” dialog.',
        ['SegmentedControl', 'Surface', 'Text'],
      ),
    ],
    props: [
      { name: 'plans', type: '{ id, name, highlight?, action? }[]', description: 'Columns.' },
      { name: 'groups', type: '{ title, rows: { label, hint?, values }[] }[]', description: 'values keyed by plan id: boolean, string, number or null.' },
      { name: 'label', type: 'string', description: 'Table caption.' },
    ],
  },
}
