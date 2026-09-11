import { Suspense, useState, type ReactNode } from 'react'
import { Surface, Tabs } from 'citrine'
import { blockCount } from '../../data/blocks'
import { blockComponent } from '../../lib/blocks'
import { LandingSection, SectionLink } from './primitives'

/**
 * Whole screens, live.
 *
 * The strongest thing a component library can show is the thing people are
 * about to build. Each tab is a real block, loaded through the same loader as
 * the block pages, and only the open one is mounted — Tabs renders the current
 * panel alone — so four screens cost the page one.
 */
const SCREENS = [
  { value: 'admin', label: 'Admin panel', file: 'AdminBlock.tsx' },
  { value: 'dashboard', label: 'Operations', file: 'DashboardBlock.tsx' },
  { value: 'settings', label: 'Settings', file: 'SettingsBlock.tsx' },
  { value: 'login', label: 'Sign in', file: 'LoginBlock.tsx' },
] as const

type ScreenKey = (typeof SCREENS)[number]['value']

export function Screens() {
  const [screen, setScreen] = useState<ScreenKey>('admin')

  const frame = (slug: string, node: ReactNode) => (
    <div className="flex flex-col gap-3 pt-4">
      <Surface variant="sunken" padding="none" className="overflow-hidden bg-app p-3 sm:p-5">
        <Suspense fallback={<div className="min-h-[540px]" aria-busy="true" />}>{node}</Suspense>
      </Surface>
      <SectionLink to={`/blocks/${slug}`}>Open this screen with its source</SectionLink>
    </div>
  )

  return (
    <LandingSection
      id="screens"
      eyebrow="Screens"
      title="Real screens, not screenshots"
      lede="Every block is assembled from the library and nothing else — no colour, radius or spacing of its own. Sort the tables, open the dialogs, flip the switches: every control is wired."
      action={<SectionLink to="/blocks">All {blockCount} screens</SectionLink>}
    >
      <Tabs
        label="Example screens"
        value={screen}
        onValueChange={(value) => setScreen(value as ScreenKey)}
        items={SCREENS.map((entry) => {
          const Block = blockComponent(entry.file)
          return {
            value: entry.value,
            label: entry.label,
            content: frame(entry.value, Block ? <Block embedded /> : null),
          }
        })}
      />
    </LandingSection>
  )
}
