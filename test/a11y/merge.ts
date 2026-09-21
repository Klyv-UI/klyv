import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPORT, SHARD_REPORTS, type ShardReport } from './report'

/**
 * Vitest global setup. Clears the shard reports before a run, and after it
 * joins them into test/a11y-report.json — in page order, as the single-file
 * suite wrote it — but only when every shard audited every page it was given.
 * A partial run leaves the last complete report alone.
 */
export default function setup() {
  rmSync(SHARD_REPORTS, { recursive: true, force: true })

  return function teardown() {
    if (!existsSync(SHARD_REPORTS)) return // no a11y shard ran
    const shards: ShardReport[] = readdirSync(SHARD_REPORTS)
      .filter((file) => file.endsWith('.json'))
      .map((file) => JSON.parse(readFileSync(join(SHARD_REPORTS, file), 'utf8')))
    rmSync(SHARD_REPORTS, { recursive: true, force: true })

    const count = shards[0]?.count ?? 0
    const complete =
      shards.length === count && shards.every((shard) => shard.audited === shard.expected)
    if (!complete) {
      console.log('a11y: partial run, test/a11y-report.json left as it was')
      return
    }

    const strip = <T extends { at: number }>({ at: _, ...rest }: T) => rest
    const byPage = (a: { at: number }, b: { at: number }) => a.at - b.at
    const findings = shards.flatMap((shard) => shard.findings).sort(byPage).map(strip)
    const crashes = shards.flatMap((shard) => shard.crashes).sort(byPage).map(strip)
    writeFileSync(REPORT, `${JSON.stringify({ crashes, findings }, null, 2)}\n`)
  }
}
