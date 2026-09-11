import { Gauge, Route, ShieldCheck, Zap } from 'lucide-react'
import { Badge, Button, Metric, Surface, Text } from 'citrine'

/**
 * A marketing landing section.
 *
 * The accent does the persuading: one hue on the eyebrow, the primary action
 * and the feature glyphs, and nothing else competing for it. No gradient text
 * and no photographic hero, because both would be the one thing on the page the
 * design system cannot re-theme.
 */
export default function FeaturedBlock() {
  return (
    <div className="flex w-full flex-col gap-6 px-4 py-10">
      <section className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-5 text-center">
        <Badge>Now routing in 14 countries</Badge>

        <Text as="h1" size="display" className="text-balance">
          Freight that arrives when you said it would
        </Text>

        <Text
          size="body"
          weight="medium"
          tone="soft"
          leading="normal"
          className="max-w-[56ch] text-balance"
        >
          Meridian plans the lane, watches the truck and tells the customer before you have to.
          One console for dispatch, exceptions and proof of delivery.
        </Text>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button>Book a demo</Button>
          <Button variant="outline">Read the docs</Button>
        </div>

        <Text size="micro" tone="faint">
          No card required · Onboarding in a fortnight
        </Text>
      </section>

      <section className="mx-auto grid w-full max-w-[900px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <Surface key={feature.title} variant="tile" padding="md" className="gap-2.5">
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-[10px] bg-accent-soft text-accent"
            >
              <feature.icon size={17} />
            </span>
            <Text size="heading">{feature.title}</Text>
            <Text size="caption" tone="faint" leading="normal">
              {feature.body}
            </Text>
          </Surface>
        ))}
      </section>

      <section className="mx-auto w-full max-w-[900px]">
        <Surface variant="card" padding="lg">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Metric label="On-time rate" value="94.1%" delta="+1.4pts" trend="up" />
            <Metric label="Loads a month" value="38k" caption="across the network" />
            <Metric label="Avg dwell" value="41m" delta="-8m" trend="down" />
            <Metric label="Depots live" value="14" caption="EU and UK" />
          </div>
        </Surface>
      </section>

      <section className="mx-auto w-full max-w-[900px]">
        <Surface variant="card" padding="lg" className="items-center gap-3 text-center">
          <Text size="subtitle" className="text-balance">
            Move your first lane this month
          </Text>
          <Text size="caption" tone="soft" leading="normal" className="max-w-[52ch]">
            We migrate your lanes, your rates and your proof-of-delivery archive. Most teams are
            dispatching from Meridian inside two weeks.
          </Text>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button>Talk to us</Button>
            <Button variant="ghost">See pricing</Button>
          </div>
        </Surface>
      </section>
    </div>
  )
}

const FEATURES = [
  {
    icon: Route,
    title: 'Lane planning',
    body: 'Cost, emissions and driver hours weighed together, not one after the other.',
  },
  {
    icon: Zap,
    title: 'Live exceptions',
    body: 'A delay raises itself, with the affected customers already listed.',
  },
  {
    icon: Gauge,
    title: 'Dwell tracking',
    body: 'Gate-in to gate-out per depot, so the slow yard is obvious.',
  },
  {
    icon: ShieldCheck,
    title: 'Proof of delivery',
    body: 'Signature, photo and timestamp, kept for the seven years compliance wants.',
  },
]
