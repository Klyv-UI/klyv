import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * Every block is shown inside a page's own main landmark, so each one is told
 * it is embedded. Blocks without a shell of their own simply ignore it.
 */
export interface BlockProps {
  embedded?: boolean
}

/**
 * Every block file as its own lazy chunk, keyed by file name — the name each
 * entry in blocks.ts records. Adding a block is one entry and one file; there
 * is no second map here to forget, and the generator fails the build when an
 * entry names a file that does not exist.
 *
 * Shared by the block page, the Composer and Built With, so a block loaded by
 * one is not fetched again by another.
 */
const MODULES = import.meta.glob<{ default: ComponentType<BlockProps> }>('../blocks/*.tsx')
const loaded = new Map<string, LazyExoticComponent<ComponentType<BlockProps>>>()

export function blockComponent(file: string): LazyExoticComponent<ComponentType<BlockProps>> | undefined {
  const known = loaded.get(file)
  if (known) return known
  const load = MODULES[`../blocks/${file}`]
  if (!load) return undefined
  const component = lazy(load)
  loaded.set(file, component)
  return component
}

/**
 * Starts downloading a block's module without rendering it, for prefetching.
 * The lazy component above imports the same module, so once this settles the
 * block page renders its screen without waiting.
 */
export function preloadBlock(file: string): Promise<unknown> | undefined {
  return MODULES[`../blocks/${file}`]?.()
}

/** "LoginBlock.tsx" → "LoginBlock", the name its default export takes in a paste. */
export const blockExportName = (file: string) => file.replace(/\.tsx$/, '')
