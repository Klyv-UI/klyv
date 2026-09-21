import { join } from 'node:path'

// From the project root, which is where vitest runs: under jsdom,
// import.meta.url is not a file URL, so it cannot locate these.

/** Where each shard leaves what it found, for merge.ts to join. */
export const SHARD_REPORTS = join(process.cwd(), 'test', 'a11y', '.reports')

/** The file the docs, the evidence generator and CI read. */
export const REPORT = join(process.cwd(), 'test', 'a11y-report.json')

export interface ShardReport {
  index: number
  count: number
  /** Pages across every shard. */
  total: number
  /** Pages this shard was given, and how many of them it audited. */
  expected: number
  audited: number
  /** `at` is the page's position in the full list, so the merge can restore the order. */
  findings: ({ slug: string; at: number } & Record<string, unknown>)[]
  crashes: { slug: string; error: string; at: number }[]
}
