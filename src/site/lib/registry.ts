import type { ComponentType } from 'react'

/**
 * Library components by name, filled in as site modules load.
 *
 * The calls are added at build time (see vite.klyv.ts): each module that
 * imports components from `klyvui` registers exactly those. Names cannot be
 * read off the functions themselves, because minification renames them.
 */
export type AnyComponent = ComponentType<Record<string, unknown>>

const components = new Map<string, AnyComponent>()

export function registerComponents(found: Record<string, unknown>): void {
  for (const [name, component] of Object.entries(found)) {
    if (typeof component === 'function') components.set(name, component as AnyComponent)
  }
}

/** The component exported under this name, once a module that uses it has loaded. */
export function componentNamed(name: string): AnyComponent | undefined {
  return components.get(name)
}
