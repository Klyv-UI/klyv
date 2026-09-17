import { Suspense, useState, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Tabs } from 'klyv'
import { blockCount } from '../../data/blocks'
import { blockComponent } from '../../lib/blocks'
import { LandingSection, SectionLink, WindowDots } from './primitives'

/**
 * Whole screens, live.
 *
 * The strongest thing a component library can show is the thing people are
 * about to build. Each tab is a real block, loaded through the same loader as
 * the block pages, and only the open one is mounted — Tabs renders the current
 * panel alone — so four screens cost the page one.
 */
const SCREENS = [
  { value: 'admin', label: 'Admin panel', file: 'AdminBlock.tsx', path: 'admin' },
  { value: 'dashboard', label: 'Operations', file: 'DashboardBlock.tsx', path: 'operations' },
  { value: 'settings', label: 'Settings', file: 'SettingsBlock.tsx', path: 'settings' },
  { value: 'login', label: 'Sign in', file: 'LoginBlock.tsx', path: 'sign-in' },
] as const

type Screen = (typeof SCREENS)[number]
type ScreenKey = Screen['value']

export function Screens() {
  const [screen, setScreen] = useState<ScreenKey>('admin')

  // Each block sits in a browser window — an address, the source file it comes
  // from — so it reads as a screen someone would use, not a specimen on a tray.
  const frame = (entry: Screen, node: ReactNode) => (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-window)]">
        <div className="grid grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-3 border-b border-line px-4 py-2.5">
          <WindowDots />
          <span className="flex h-7 min-w-0 items-center gap-1.5 rounded-full bg-surface-muted px-3 sm:w-[300px] sm:justify-center">
            <Lock size={11} strokeWidth={2.5} aria-hidden className="shrink-0 text-ink-soft" />
            <span className="truncate font-mono text-[11.5px] font-semibold text-ink-soft">acme.app/{entry.path}</span>
          </span>
          <span className="hidden justify-self-end truncate font-mono text-[11.5px] font-semibold text-ink-faint sm:block">
            {entry.file}
          </span>
        </div>
        <div className="bg-app p-3 sm:p-5">
          <Suspense fallback={<div className="min-h-[540px]" aria-busy="true" />}>{node}</Suspense>
        </div>
      </div>
      <SectionLink to={`/blocks/${entry.value}`}>Open this screen with its source</SectionLink>
    </div>
  )

  return (
    <LandingSection
      id="screens"
      eyebrow="Screens"
      index={3}
      title="Real screens,"
      tail="not screenshots"
      lede="Every block is assembled from the library and nothing else — no colour, radius or spacing of its own. Sort the tables, open the dialogs, flip the switches: every control is wired."
      action={<SectionLink to="/blocks">All {blockCount} screens</SectionLink>}
    >
      <Tabs
        label="Example screens"
        className="[&>[role=tablist]]:self-center"
        value={screen}
        onValueChange={(value) => setScreen(value as ScreenKey)}
        items={SCREENS.map((entry) => {
          const Block = blockComponent(entry.file)
          return {
            value: entry.value,
            label: entry.label,
            content: frame(entry, Block ? <Block embedded /> : null),
          }
        })}
      />
    </LandingSection>
  )
}
