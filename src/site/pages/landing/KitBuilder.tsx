import { Suspense, lazy } from 'react'
import { LazyMount, Skeleton } from 'klyv'
import { LandingSection } from './primitives'

/**
 * The kit builder: pick the components a product needs and read, exactly,
 * what they add to a bundle — before installing anything.
 *
 * The weighing needs the whole dependency graph and a size for every built
 * module, which is more than the rest of the page should carry, so the panel
 * and its data load only as the section nears the viewport.
 */
const KitBuilderPanel = lazy(() => import('./KitBuilderPanel'))

export function KitBuilder() {
  return (
    <LandingSection
      id="kit"
      index={12}
      eyebrow="Kit builder"
      title="Know what it weighs"
      tail="before you install it."
      lede="Pick the components your product needs. The total is worked out from the real build: every module each one pulls in, with code they share counted once — and the install command for exactly that set."
    >
      <LazyMount rootMargin="400px" minHeight={560}>
        <Suspense fallback={<Skeleton shape="rect" height={560} className="w-full rounded-[var(--radius-window)]" />}>
          <KitBuilderPanel />
        </Suspense>
      </LazyMount>
    </LandingSection>
  )
}
