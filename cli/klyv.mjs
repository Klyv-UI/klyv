#!/usr/bin/env node
// klyv — copy components into your project, with everything they need.
//
// The library's folders are flat and its imports are relative, which is what
// makes this possible without rewriting a single line: mirror the same shape
// under your destination and every import resolves exactly as it did here.
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs'
import { basename, join, dirname, relative, isAbsolute, resolve as resolvePathFrom } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SRC = join(ROOT, 'src')

const META = JSON.parse(readFileSync(join(ROOT, 'data', 'components.json'), 'utf8'))
const COMPONENTS = META.components
const SHARED = META.shared
const CATALOG = META.catalog ?? {}

const NAMES = Object.keys(COMPONENTS).sort()

const resolvePath = (input) =>
  isAbsolute(input) ? input : resolvePathFrom(process.cwd(), input)

/* ------------------------------------------------------------------ colour */
const useColour = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code, text) => (useColour ? `[${code}m${text}[0m` : text)
const bold = (t) => paint('1', t)
const dim = (t) => paint('2', t)
const green = (t) => paint('32', t)
const red = (t) => paint('31', t)
const cyan = (t) => paint('36', t)

/* ------------------------------------------------------------- resolution */

/** "data-table", "DataTable" and "datatable" all mean the same component. */
function resolveName(input) {
  const flat = input.replace(/[-_\s]/g, '').toLowerCase()
  return NAMES.find((name) => name.toLowerCase() === flat)
}

/** Edit distance, capped — enough to catch a typo, cheap enough for 239 names. */
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 4) return 99
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i]
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        previous[j] + 1,
        row[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = row
  }
  return previous[b.length]
}

/**
 * Near misses for a name that did not resolve.
 *
 * Substring first, then edit distance — "datatabel" contains no component name,
 * so a substring-only suggester says nothing at exactly the moment a suggestion
 * would help most.
 */
function suggest(input) {
  const flat = input.replace(/[-_\s]/g, '').toLowerCase()
  const contains = NAMES.filter((name) => name.toLowerCase().includes(flat))
  if (contains.length) return contains.slice(0, 6)

  return NAMES.map((name) => ({ name, score: distance(flat, name.toLowerCase()) }))
    .filter((entry) => entry.score <= Math.max(2, Math.floor(flat.length / 3)))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((entry) => entry.name)
}

/** Name, slug, group, section and blurb — the same field set the site searches. */
function matches(name, query) {
  const needle = query.toLowerCase()
  if (name.toLowerCase().includes(needle)) return true
  const entry = CATALOG[name]
  if (!entry) return false
  return [entry.slug, entry.group, entry.section, entry.blurb].some((field) =>
    field.toLowerCase().includes(needle),
  )
}

/**
 * Everything one component needs, depth first, with the component itself last.
 * Mirrors `dependenciesOf` in the docs site — both are generated from the same
 * graph, so what the site shows is what this writes.
 */
function resolve(name) {
  const seen = new Set()
  const order = []

  const walk = (current) => {
    if (seen.has(current)) return
    seen.add(current)
    for (const dep of COMPONENTS[current]?.internal ?? []) walk(dep)
    order.push(current)
  }
  walk(name)

  const shared = new Set()
  const external = new Set()
  for (const component of order) {
    for (const path of COMPONENTS[component].shared) {
      shared.add(path)
      for (const nested of SHARED[path] ?? []) shared.add(nested)
    }
    for (const pkg of COMPONENTS[component].external) external.add(pkg)
  }

  const sharedFiles = [...shared].sort()
  return {
    components: order,
    shared: sharedFiles,
    external: [...external].sort(),
    files: [...sharedFiles, ...order.flatMap((component) => COMPONENTS[component].files)],
  }
}

/* -------------------------------------------------------------- commands */

/**
 * Splits flags from names.
 *
 * `--dest` takes a value, so its argument has to be consumed rather than left
 * to fall through as a component name — which is exactly the bug a naive
 * `filter(arg => !arg.startsWith('-'))` produces.
 */
function parseArgs(args) {
  const names = []
  const flags = new Set()
  let dest = null

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--dest' || arg === '-d') {
      dest = args[index + 1]
      index += 1
    } else if (arg.startsWith('--dest=')) {
      dest = arg.slice('--dest='.length)
    } else if (arg.startsWith('-')) {
      flags.add(arg)
    } else {
      names.push(arg)
    }
  }
  return { names, flags, dest }
}

function add(args) {
  if (args[0] === 'block' || args[0] === 'blocks') return addBlocks(args.slice(1))
  const parsed = parseArgs(args)
  const requested = parsed.names
  const dry = parsed.flags.has('--dry') || parsed.flags.has('-n')
  const force = parsed.flags.has('--force') || parsed.flags.has('-f')
  const dest = parsed.dest ? resolvePath(parsed.dest) : join(process.cwd(), 'src')

  if (requested.length === 0) {
    console.error(red('Name a component. Try `klyv list` to see them.'))
    process.exit(1)
  }

  const names = []
  for (const input of requested) {
    const name = resolveName(input)
    if (!name) {
      console.error(red(`No component called "${input}".`))
      const block = resolveBlock(input)
      if (block) {
        console.error(dim(`"${input}" is a block: klyv add block ${block.slug}`))
        process.exit(1)
      }
      const near = suggest(input)
      if (near.length) console.error(dim(`Did you mean: ${near.join(', ')}?`))
      process.exit(1)
    }
    names.push(name)
  }

  // One resolution for all requested components, so shared dependencies are
  // written once rather than once per component.
  const files = new Set()
  const components = new Set()
  const shared = new Set()
  const external = new Set()
  for (const name of names) {
    const resolved = resolve(name)
    resolved.files.forEach((file) => files.add(file))
    resolved.components.forEach((entry) => components.add(entry))
    resolved.shared.forEach((entry) => shared.add(entry))
    resolved.external.forEach((entry) => external.add(entry))
  }

  const asked = new Set(names)
  const extra = [...components].filter((name) => !asked.has(name))

  console.log('')
  console.log(`${bold(names.join(', '))} ${dim('->')} ${cyan(relative(process.cwd(), dest) || dest)}`)
  if (extra.length) {
    console.log(dim(`  brings ${extra.length} component${extra.length === 1 ? '' : 's'}: ${extra.join(', ')}`))
  }
  if (shared.size) console.log(dim(`  shared: ${[...shared].join(', ')}`))
  console.log('')

  let written = 0
  let skipped = 0
  for (const file of [...files].sort()) {
    const from = join(SRC, file)
    const to = join(dest, file)
    if (!existsSync(from)) {
      console.error(red(`  missing in package: ${file}`))
      process.exit(1)
    }
    if (existsSync(to) && !force) {
      console.log(`  ${dim('skip')}  ${file} ${dim('(exists)')}`)
      skipped += 1
      continue
    }
    if (!dry) {
      mkdirSync(dirname(to), { recursive: true })
      writeFileSync(to, readFileSync(from))
    }
    console.log(`  ${green('write')} ${file}`)
    written += 1
  }

  // The tokens are not optional: every component reads them, and without the
  // stylesheet the copied files render unstyled.
  const stylesTarget = join(dest, 'styles')
  if (!existsSync(stylesTarget)) {
    if (!dry) cpSync(join(SRC, 'styles'), stylesTarget, { recursive: true })
    console.log(`  ${green('write')} styles/ ${dim('(tokens, base layer, keyframes)')}`)
    console.log('')
    console.log(dim("  Import it once, after Tailwind: import './styles/index.css'"))
  }

  console.log('')
  console.log(
    `${written} file${written === 1 ? '' : 's'} written` +
      (skipped ? `, ${skipped} skipped (pass --force to overwrite)` : '') +
      (dry ? dim(' — dry run, nothing touched') : ''),
  )
  if (external.size) {
    const installable = [...external].filter((pkg) => pkg !== 'react')
    if (installable.length) {
      console.log(dim(`\nRequires: ${installable.join(' ')}`))
      console.log(dim(`  npm install ${installable.join(' ')}`))
    }
  }
  console.log('')
}

function list(args) {
  const query = parseArgs(args).names[0]
  const found = query ? NAMES.filter((name) => matches(name, query)) : NAMES

  if (found.length === 0) {
    console.log(`Nothing matches "${query}".`)
    const near = suggest(query)
    if (near.length) console.log(dim(`Did you mean: ${near.join(', ')}?`))
    return
  }

  for (const name of found) {
    const count = resolve(name).components.length - 1
    const suffix = count ? dim(` +${count}`) : ''
    const entry = CATALOG[name]
    const where = entry ? dim(`  ${entry.group} / ${entry.section}`) : ''
    console.log(`  ${name}${suffix}${where}`)
  }
  console.log('')
  console.log(dim(`${found.length} of ${NAMES.length} components. The +n is how many come with it.`))
}

function info(args) {
  const input = parseArgs(args).names[0]
  const name = input && resolveName(input)
  if (!name) {
    console.error(red(`No component called "${input ?? ''}".`))
    process.exit(1)
  }

  const resolved = resolve(name)
  const entry = CATALOG[name]
  console.log('')
  console.log(bold(name))
  if (entry) {
    console.log(dim(`  ${entry.group} / ${entry.section}`))
    console.log(dim(`  ${entry.blurb}`))
    console.log('')
  }
  console.log(dim(`  files      ${COMPONENTS[name].files.length}`))
  console.log(dim(`  needs      ${resolved.components.filter((c) => c !== name).join(', ') || 'nothing else'}`))
  console.log(dim(`  shared     ${resolved.shared.join(', ') || 'none'}`))
  console.log(dim(`  npm        ${resolved.external.join(', ')}`))
  console.log(dim(`  total      ${resolved.files.length} files to copy`))
  console.log('')
}

/* ------------------------------------------------------------------ blocks */

// Whole screens. A block imports from the klyv package rather than from
// sibling folders, so it is copied as one file, and what it needs is installed
// rather than copied beside it.
const BLOCKS_FILE = join(ROOT, 'data', 'blocks.json')
const BLOCKS = existsSync(BLOCKS_FILE) ? JSON.parse(readFileSync(BLOCKS_FILE, 'utf8')).blocks : []

/** 'dashboard', 'Dashboard', 'two-factor' and 'DashboardBlock' all find a block. */
function resolveBlock(input) {
  const flat = input.replace(/[-_\s]/g, '').toLowerCase()
  return BLOCKS.find((block) =>
    [block.slug, block.name, basename(block.file, '.tsx')].some(
      (key) => key.replace(/[-_\s]/g, '').toLowerCase() === flat,
    ),
  )
}

function addBlocks(args) {
  const parsed = parseArgs(args)
  const dry = parsed.flags.has('--dry') || parsed.flags.has('-n')
  const force = parsed.flags.has('--force') || parsed.flags.has('-f')
  const dest = parsed.dest ? resolvePath(parsed.dest) : join(process.cwd(), 'src')

  if (parsed.names.length === 0) {
    console.error(red('Name a block. Try `klyv blocks` to see them.'))
    process.exit(1)
  }

  const chosen = []
  for (const input of parsed.names) {
    const block = resolveBlock(input)
    if (!block) {
      console.error(red(`No block called "${input}".`))
      console.error(dim(`Blocks: ${BLOCKS.map((entry) => entry.slug).join(', ')}`))
      process.exit(1)
    }
    chosen.push(block)
  }

  const packages = new Set()
  let written = 0
  let skipped = 0
  console.log('')

  for (const block of chosen) {
    const from = join(ROOT, block.file)
    const to = join(dest, 'blocks', basename(block.file))
    console.log(`${bold(block.name)} ${dim('->')} ${cyan(relative(process.cwd(), to) || to)}`)
    console.log(dim(`  built from ${block.components.length} components: ${block.components.join(', ')}`))
    block.packages.forEach((pkg) => packages.add(pkg))

    if (!existsSync(from)) {
      console.error(red(`  missing in package: ${block.file}`))
      process.exit(1)
    }
    if (existsSync(to) && !force) {
      console.log(`  ${dim('skip')}  ${basename(to)} ${dim('(exists)')}`)
      skipped += 1
      continue
    }
    if (!dry) {
      mkdirSync(dirname(to), { recursive: true })
      writeFileSync(to, readFileSync(from))
    }
    console.log(`  ${green('write')} ${basename(to)}`)
    written += 1
  }

  console.log('')
  console.log(
    `${written} block${written === 1 ? '' : 's'} written` +
      (skipped ? `, ${skipped} skipped (pass --force to overwrite)` : '') +
      (dry ? dim(' — dry run, nothing touched') : ''),
  )
  const installable = [...packages].filter((pkg) => pkg !== 'react').sort()
  if (installable.length) {
    console.log(dim(`\nRequires: ${installable.join(' ')}`))
    console.log(dim(`  npm install ${installable.join(' ')}`))
  }
  console.log(dim('\nBlocks import from the klyv package. Copied components instead of installing?'))
  console.log(dim('Point the imports at your copies — the names are the same.'))
  console.log('')
}

function listBlocks(args) {
  const query = parseArgs(args).names[0]?.toLowerCase()
  const found = BLOCKS.filter(
    (block) =>
      !query ||
      [block.slug, block.name, block.category, block.blurb].some((field) =>
        field.toLowerCase().includes(query),
      ),
  )

  if (found.length === 0) {
    console.log(`No block matches "${query}".`)
    return
  }
  for (const block of found) {
    console.log(`  ${block.slug.padEnd(16)}${block.name}${dim(`  ${block.category} · ${block.components.length} components`)}`)
  }
  console.log('')
  console.log(dim(`${found.length} of ${BLOCKS.length} blocks. Copy one with: klyv add block <slug>`))
}

function help() {
  console.log(`
${bold('klyv')} — copy components into your project, with what they need.

  ${cyan('klyv add')} <name...> ${dim('[--dest src] [--dry] [--force]')}
      Copy a component and every file it imports. Names are flexible:
      ${dim('klyv add data-table   klyv add DataTable   klyv add datatable')}

  ${cyan('klyv list')} ${dim('[query]')}
      List components. The +n shows how many others come with each.

  ${cyan('klyv info')} <name>
      What one component would bring with it.

  ${cyan('klyv add block')} <slug...> ${dim('[--dest src] [--dry] [--force]')}
      Copy a whole screen into src/blocks. It imports from the klyv package.

  ${cyan('klyv blocks')} ${dim('[query]')}
      List the blocks.

  ${cyan('klyv mcp')}
      Start the MCP server on stdio, for AI coding agents.

${dim('The folder layout is preserved, so every relative import resolves')}
${dim('unchanged — no rewriting, no codemod, no build step.')}
`)
}

const [command, ...rest] = process.argv.slice(2)

switch (command) {
  case 'add':
    add(rest)
    break
  case 'list':
  case 'ls':
    list(rest)
    break
  case 'info':
    info(rest)
    break
  case 'blocks':
    listBlocks(rest)
    break
  case 'mcp':
    // Lets `npx -y klyv mcp` start the server without a second package.
    ;(await import('../mcp/server.mjs')).listen()
    break
  case undefined:
  case 'help':
  case '--help':
  case '-h':
    help()
    break
  default:
    console.error(red(`Unknown command: ${command}`))
    help()
    process.exit(1)
}
