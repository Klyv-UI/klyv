import { componentEvidence } from './evidence'
import { isNewComponent } from './catalog'

/**
 * Component health: a status, and the capabilities there is evidence for.
 *
 * The status is a decision, so it is written down here in one place. Every
 * component shipped in 1.0 is stable unless it is listed below; no component
 * has been moved to beta, experimental or deprecated yet, and the map stays
 * empty until one is.
 *
 * The capabilities are measurements, read from `evidence.ts` (generated from
 * the source tree and the test suites). A capability with no evidence is not
 * shown — "responsive", for one, is not measured anywhere yet, so it is never
 * claimed.
 */
export type ComponentStatus = 'stable' | 'beta' | 'experimental' | 'deprecated'

export const STATUS_OVERRIDES: Record<string, ComponentStatus> = {}

export const STATUS_LABELS: Record<ComponentStatus, string> = {
  stable: 'Stable',
  beta: 'Beta',
  experimental: 'Experimental',
  deprecated: 'Deprecated',
}

export type CapabilityId = 'typescript' | 'darkMode' | 'accessible' | 'keyboard' | 'server' | 'reducedMotion'

export interface Capability {
  id: CapabilityId
  label: string
  /** Where the claim comes from, in a sentence. */
  evidence: string
}

export interface ComponentHealth {
  status: ComponentStatus
  isNew: boolean
  capabilities: Capability[]
}

export function statusOf(name: string): ComponentStatus {
  return STATUS_OVERRIDES[name] ?? 'stable'
}

const cache = new Map<string, ComponentHealth | undefined>()

export function healthOf(name: string): ComponentHealth | undefined {
  if (cache.has(name)) return cache.get(name)

  const evidence = componentEvidence[name]
  let health: ComponentHealth | undefined
  if (evidence) {
    const capabilities: Capability[] = [
      {
        id: 'typescript',
        label: 'TypeScript',
        evidence: 'Written in TypeScript and shipped with declarations; the API table is generated from the type.',
      },
    ]
    if (evidence.tokenColours) {
      capabilities.push({
        id: 'darkMode',
        label: 'Dark mode',
        evidence: 'No hex literal in its source: every colour is a token, so the dark theme repaints all of it.',
      })
    }
    if (evidence.axe) {
      capabilities.push({
        id: 'accessible',
        label: 'Axe-audited',
        evidence:
          'Its docs page had no axe violations in the last recorded run. Contrast is audited separately, in a real browser.',
      })
    }
    if (evidence.keyboardSuite) {
      capabilities.push({
        id: 'keyboard',
        label: 'Keyboard tested',
        evidence: `Driven from the keyboard with user-event in ${evidence.keyboardSuite}.`,
      })
    }
    if (evidence.serverSafe) {
      capabilities.push({
        id: 'server',
        label: 'Server-safe',
        evidence: "No 'use client' in any of its modules, so it renders in a React Server Component.",
      })
    }
    if (evidence.reducedMotion) {
      capabilities.push({
        id: 'reducedMotion',
        label: 'Reduced motion',
        evidence: 'It animates, and has a still state under prefers-reduced-motion.',
      })
    }
    health = { status: statusOf(name), isNew: isNewComponent(name), capabilities }
  }

  cache.set(name, health)
  return health
}
