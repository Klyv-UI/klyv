// Writes a Markdown report for a CI job to its GitHub Actions summary page, from
// the files the job already produced. Outside Actions it prints to stdout, so a
// report can be previewed locally.
//
//   node scripts/ci-summary.mjs steps    just the step outcomes, under the heading in TITLE
//   node scripts/ci-summary.mjs checks   the check steps' outcomes, stale generated files
//   node scripts/ci-summary.mjs a11y     the axe report: crashes and findings
//   node scripts/ci-summary.mjs package  the built package's size, from data/sizes.json
//   node scripts/ci-summary.mjs site     the docs site's largest chunks, and where it went
//
// Step outcomes arrive in OUTCOMES, one `Step name=outcome` per line in the
// order the steps run, so a job reports the steps that failed as well as the
// ones that passed.
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const kB = (bytes) => `${(bytes / 1024).toFixed(1)} kB`
const ICON = { success: '✅', failure: '❌', cancelled: '⏹️', skipped: '⏭️' }

function outcomes() {
  const rows = (process.env.OUTCOMES ?? '')
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const at = line.lastIndexOf('=')
      const value = line.slice(at + 1).trim()
      return `| ${line.slice(0, at).trim()} | ${ICON[value] ?? '❔'} ${value || 'not run'} |`
    })
  return rows.length ? ['| Step | Result |', '| --- | --- |', ...rows, ''] : []
}

const reports = {
  // Just the step outcomes, under the heading in TITLE.
  steps() {
    return [`## ${process.env.TITLE ?? 'Steps'}`, '', ...outcomes()]
  },

  checks() {
    const lines = ['## Types, preset and generated data', '', ...outcomes()]
    // The generated-data step leaves its regenerated copies in the tree, so
    // anything that differs from the commit is what went stale.
    const stale = execSync('git diff --name-only -- data src/site/data', { cwd: ROOT, encoding: 'utf8' }).trim()
    if (stale) {
      lines.push(
        '**Stale generated files.** Run `npm run generate` and commit the result:',
        '',
        ...stale.split('\n').map((file) => `- \`${file}\``),
        '',
      )
    }
    return lines
  },

  a11y() {
    const lines = ['## Accessibility (axe)', '', ...outcomes()]
    const path = join(ROOT, 'test', 'a11y-report.json')
    if (!existsSync(path)) return [...lines, 'No report: the suite did not get far enough to write one.', '']
    const { crashes, findings } = JSON.parse(readFileSync(path, 'utf8'))
    if (!crashes.length && !findings.length) return [...lines, 'Every audited page passed: no findings, no crashes.', '']
    lines.push(`**${findings.length} finding(s), ${crashes.length} crash(es).**`, '')
    if (findings.length) {
      lines.push('| Page | Rule | Impact | Nodes | Target |', '| --- | --- | --- | --- | --- |')
      for (const f of findings) lines.push(`| ${f.slug} | ${f.rule} | ${f.impact} | ${f.nodes} | \`${f.target}\` |`)
      lines.push('')
    }
    if (crashes.length) {
      lines.push('| Page | Crash |', '| --- | --- |')
      for (const c of crashes) lines.push(`| ${c.slug} | ${String(c.error ?? c.message ?? '').split('\n')[0]} |`)
      lines.push('')
    }
    return lines
  },

  package() {
    const lines = ['## Package build', '', ...outcomes()]
    const path = join(ROOT, 'data', 'sizes.json')
    if (!existsSync(path)) return [...lines, 'No size data: the build did not finish.', '']
    const { library } = JSON.parse(readFileSync(path, 'utf8'))
    lines.push(
      '| | |',
      '| --- | --- |',
      `| Whole library (gzip) | ${kB(library.gzip)} |`,
      `| Modules | ${library.modules} |`,
      `| Median component (gzip) | ${kB(library.median)} |`,
      `| Lightest | ${library.lightest.name}, ${kB(library.lightest.gzip)} |`,
      `| Heaviest | ${library.heaviest.name}, ${kB(library.heaviest.gzip)} |`,
      '',
    )
    const css = join(ROOT, 'dist', 'klyv.css')
    if (existsSync(css)) {
      const source = readFileSync(css)
      lines.push(`Stylesheet \`klyv.css\`: ${kB(source.length)}, ${kB(gzipSync(source).length)} gzip.`, '')
    }
    return lines
  },

  site() {
    const lines = ['## Docs site', '', ...outcomes()]
    if (process.env.SITE_URL) lines.push(`Live at **${process.env.SITE_URL}**.`, '')
    const dir = join(ROOT, 'dist-site', 'assets')
    if (!existsSync(dir)) return [...lines, 'No build output.', '']
    const chunks = readdirSync(dir)
      .filter((file) => file.endsWith('.js'))
      .map((file) => {
        const source = readFileSync(join(dir, file))
        return { file, bytes: statSync(join(dir, file)).size, gzip: gzipSync(source).length }
      })
      .sort((a, b) => b.bytes - a.bytes)
    const total = chunks.reduce((sum, chunk) => sum + chunk.gzip, 0)
    lines.push(
      `${chunks.length} JavaScript chunks, ${kB(total)} gzip in all. The largest:`,
      '',
      '| Chunk | Size | Gzip |',
      '| --- | --- | --- |',
      ...chunks.slice(0, 8).map((chunk) => `| \`${chunk.file}\` | ${kB(chunk.bytes)} | ${kB(chunk.gzip)} |`),
      '',
    )
    return lines
  },
}

const kind = process.argv[2]
if (!reports[kind]) {
  console.error(`ci-summary: expected one of ${Object.keys(reports).join(', ')}`)
  process.exit(1)
}

const markdown = `${reports[kind]().join('\n')}\n`
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown)
else process.stdout.write(markdown)
