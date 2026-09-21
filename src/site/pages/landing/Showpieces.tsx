import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import {
  Badge,
  Button,
  ClothPanel,
  FluidCanvas,
  LazyMount,
  LightCaster,
  ShatterDismiss,
  Surface,
  Tabs,
  Tag,
  Text,
} from 'klyv'
import { SHOWPIECE_COMPONENTS } from '../../data/catalog'
import { LandingSection, SectionLink } from './primitives'

/**
 * The showpieces: the components whose whole point is the moment you see them.
 *
 * The rest of the page argues that the library is complete and dependable.
 * This section argues the other half — that it can do things a component
 * library is not expected to do at all — and it has to argue it by running,
 * not by describing. Each specimen is the real component with its real props.
 *
 * Two things keep that affordable. Tabs mounts only the open panel, so four
 * simulations cost the page one; and LazyMount holds the space until the
 * section nears the viewport, so nothing starts a WebGL context or a physics
 * loop for a visitor who never scrolls this far. Both are library components,
 * which is the point again.
 */
const SPECIMENS = [
  {
    value: 'fluid',
    label: 'Fluid',
    slug: 'fluid-canvas',
    name: 'FluidCanvas',
    caption: 'A Navier–Stokes solver on the GPU, dyed in your accent. Move the pointer through it, or leave it and it drifts on its own.',
  },
  {
    value: 'cloth',
    label: 'Cloth',
    slug: 'cloth-panel',
    name: 'ClothPanel',
    caption: 'A real card on a mass-spring cloth. It hangs, catches the wind, and settles back into a card whose button still works.',
  },
  {
    value: 'light',
    label: 'Light',
    slug: 'light-caster',
    name: 'LightCaster',
    caption: 'A light source with the shadows worked out from the live layout — drag the lamp, and every card casts a soft penumbra.',
  },
  {
    value: 'shatter',
    label: 'Glass',
    slug: 'shatter-dismiss',
    name: 'ShatterDismiss',
    caption: 'Dismissal as breaking glass. The element stays mounted behind the shards, so its state survives the undo.',
  },
] as const

type Specimen = (typeof SPECIMENS)[number]['value']

export function Showpieces() {
  const [specimen, setSpecimen] = useState<Specimen>('fluid')

  return (
    <LandingSection
      id="showpieces"
      index={6}
      eyebrow="Showpieces"
      title="And then there are the ones"
      tail="that have no business being in a component library"
      lede={`${SHOWPIECE_COMPONENTS.size} of them carry a tag of their own: real fluid, real cloth, real light casting real shadows, glass that actually breaks. Every one of them takes its colour from the same accent as the buttons.`}
      action={<SectionLink to="/components?showpiece=1">See all {SHOWPIECE_COMPONENTS.size} showpieces</SectionLink>}
    >
      <LazyMount rootMargin="400px" minHeight={520}>
        <Tabs
          label="Showpieces"
          className="[&>[role=tablist]]:self-center"
          value={specimen}
          onValueChange={(value) => setSpecimen(value as Specimen)}
          items={SPECIMENS.map((entry) => ({
            value: entry.value,
            label: entry.label,
            content: (
              <div className="flex flex-col gap-3">
                <div className="overflow-hidden rounded-[var(--radius-card)] border border-line shadow-[var(--shadow-window)]">
                  {entry.value === 'fluid' && <FluidStage />}
                  {entry.value === 'cloth' && <ClothStage />}
                  {entry.value === 'light' && <LightStage />}
                  {entry.value === 'shatter' && <ShatterStage />}
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5">
                  <Text size="body" weight="medium" tone="soft" className="max-w-[72ch] text-[14px] leading-relaxed">
                    {entry.caption}
                  </Text>
                  <SectionLink to={`/components/${entry.slug}`}>{entry.name}</SectionLink>
                </div>
              </div>
            ),
          }))}
        />
      </LazyMount>
    </LandingSection>
  )
}

/* ------------------------------------------------------------------ stages */

/** The fluid, with a real call to action floating on it. */
function FluidStage() {
  return (
    <FluidCanvas quality="medium" className="h-[420px]">
      <div className="pointer-events-none flex h-full flex-col items-start justify-end gap-3 p-6 sm:p-10">
        <Badge>Showpiece</Badge>
        <Text as="h3" size="display" weight="extrabold" leading="tight" className="max-w-[16ch] tracking-[-0.04em]">
          Move the pointer through it
        </Text>
        <Text tone="soft" className="max-w-[44ch]">
          The dye is the accent token, so the colour you picked in the hero is the colour running through the fluid.
        </Text>
        <div className="pointer-events-auto mt-1">
          <Button as={Link} to="/components/fluid-canvas" variant="white" size="sm">
            Read the props
          </Button>
        </div>
      </div>
    </FluidCanvas>
  )
}

/** A woven swatch, drawn with gradients so the page loads no image for it. */
const WEAVE = {
  backgroundColor: 'var(--color-accent)',
  backgroundImage: [
    'repeating-linear-gradient(0deg, color-mix(in oklab, var(--color-accent-ink) 12%, transparent) 0 2px, transparent 2px 6px)',
    'repeating-linear-gradient(90deg, color-mix(in oklab, var(--color-accent-ink) 10%, transparent) 0 2px, transparent 2px 6px)',
  ].join(','),
}

function ClothStage() {
  const [bag, setBag] = useState(0)

  return (
    <div className="landing-dots flex h-[420px] items-start justify-center bg-surface-sunken px-4 pt-12">
      <ClothPanel pins="corners" wind={0.5} calmOnHover label="product card" className="w-full max-w-[320px]">
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
          <div className="relative h-24" style={WEAVE}>
            <span className="absolute left-3 top-3">
              <Badge tone="neutral">Linen · 180 gsm</Badge>
            </span>
          </div>
          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <Text as="h3" size="heading">
                Washed linen overshirt
              </Text>
              <Text as="span" weight="semibold" className="tabular-nums">
                €89
              </Text>
            </div>
            <Text size="caption" tone="soft" leading="normal">
              Hold the pointer over it and the wind drops, so the card settles and can be used.
            </Text>
            <div className="mt-1 flex items-center justify-between gap-3">
              <Text as="span" size="caption" tone="faint" aria-live="polite">
                {bag === 0 ? 'Free returns' : `${bag} in your bag`}
              </Text>
              <Button size="sm" onClick={() => setBag((count) => count + 1)}>
                Add to bag
              </Button>
            </div>
          </div>
        </div>
      </ClothPanel>
    </div>
  )
}

const METRICS = [
  ['Monthly revenue', '$48,210', '+12.4%'],
  ['Active seats', '1,284', '+86'],
  ['Churn', '1.9%', '−0.3 pts'],
  ['Open tickets', '37', '−11'],
  ['NPS', '62', '+4'],
  ['Uptime', '99.98%', '30 days'],
]

function LightStage() {
  return (
    <LightCaster
      defaultLights={[{ id: 'lamp', x: 0.5, y: 0.1, label: 'Desk lamp', radius: 900 }]}
      ambient={0.42}
      softness={14}
      followPointer
      motion="sway"
      className="grid h-[420px] grid-cols-2 content-center gap-4 bg-surface-sunken p-6 sm:grid-cols-3 sm:gap-6 sm:p-10"
    >
      {METRICS.map(([label, value, delta]) => (
        <div
          key={label}
          data-occluder
          className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
        >
          <Text size="caption" tone="faint" weight="semibold">
            {label}
          </Text>
          <Text size="heading" className="mt-1">
            {value}
          </Text>
          <Tag size="sm" className="mt-2">
            {delta}
          </Tag>
        </div>
      ))}
    </LightCaster>
  )
}

const NOTICES = [
  { id: 'deploy', who: 'Deploy bot', what: 'Production deploy #4182 finished in 3m 12s.', when: '2m' },
  { id: 'review', who: 'Mara Lindqvist', what: 'Requested your review on “Move billing to the new ledger”.', when: '14m' },
  { id: 'invoice', who: 'Billing', what: 'Invoice INV-2291 for €1,240.00 was paid by Northwind.', when: '1h' },
]

function ShatterStage() {
  const [gone, setGone] = useState<Record<string, boolean>>({})
  const left = NOTICES.filter((notice) => !gone[notice.id]).length

  return (
    <div className="landing-dots flex h-[420px] flex-col items-center gap-3 overflow-y-auto bg-surface-sunken p-6 sm:p-10">
      <div className="flex w-full max-w-[420px] items-center justify-between gap-3">
        <Text as="h3" size="heading" className="text-[14px]">
          Inbox · {left} unread
        </Text>
        {left < NOTICES.length && (
          <Button size="sm" variant="outline" onClick={() => setGone({})}>
            Put them back
          </Button>
        )}
      </div>
      {NOTICES.map((notice) => (
        <ShatterDismiss
          key={notice.id}
          shattered={Boolean(gone[notice.id])}
          onShatteredChange={(value) => setGone((current) => ({ ...current, [notice.id]: value }))}
          collapse
          shards={30}
          closeLabel={`Dismiss the notification from ${notice.who}`}
          className="w-full max-w-[420px]"
        >
          <Surface variant="card" padding="md" className="flex-row items-start gap-3 pr-11">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold text-accent-ink"
            >
              {notice.who[0]}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <Text size="label" weight="semibold">
                {notice.who} <span className="font-medium text-ink-faint">· {notice.when}</span>
              </Text>
              <Text size="caption" tone="soft" leading="normal">
                {notice.what}
              </Text>
            </div>
          </Surface>
        </ShatterDismiss>
      ))}
      <Text size="caption" tone="faint" className="inline-flex items-center gap-1.5">
        <Sparkles size={12} aria-hidden className="text-accent" />
        Close one. Under reduced motion it simply goes.
      </Text>
    </div>
  )
}
