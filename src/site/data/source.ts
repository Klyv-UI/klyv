/**
 * The real source of every component, read straight off disk at build time.
 *
 * `import.meta.glob` with `?raw` hands Vite the whole library as a map of lazy
 * string imports, so the Code tab on a page shows the file that is actually
 * running above it — not a copy of it that drifts. Each file stays its own
 * chunk, fetched only when someone opens the tab or asks for the bundle.
 */
const COMPONENT_RAW = import.meta.glob('../../components/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

const LIB_RAW = import.meta.glob('../../lib/*.ts', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

/** Keyed by library-relative path: `components/Button/Button.tsx`, `lib/cn.ts`. */
const BY_PATH: Record<string, () => Promise<string>> = {}
for (const [key, load] of Object.entries(COMPONENT_RAW)) {
  BY_PATH[key.replace('../../', '')] = load
}
for (const [key, load] of Object.entries(LIB_RAW)) {
  BY_PATH[key.replace('../../', '')] = load
}

export interface SourceFile {
  /** Path relative to the library root, as the CLI would write it. */
  path: string
  /** File name alone, used as the tab label. */
  name: string
  load: () => Promise<string>
}

/**
 * Every file that makes up one component, entry point first.
 *
 * Most components are a single file plus a one-line barrel; the few with a hook
 * of their own (Carousel, Popover) list it too, because copying the component
 * without it would not compile.
 */
export function sourceFilesFor(component: string): SourceFile[] {
  const prefix = `components/${component}/`

  return Object.keys(BY_PATH)
    .filter((path) => path.startsWith(prefix))
    .map((path) => ({ path, name: path.slice(prefix.length), load: BY_PATH[path] }))
    .sort(
      (a, b) => rank(a.name, component) - rank(b.name, component) || a.name.localeCompare(b.name),
    )
}

/** Entry point first, barrel last, anything else in between. */
function rank(name: string, component: string): number {
  if (name === `${component}.tsx` || name === `${component}.ts`) return 0
  if (name === 'index.ts') return 2
  return 1
}

/** Raw source for one library-relative path, or undefined if there is none. */
export function loadSource(path: string): Promise<string> | undefined {
  return BY_PATH[path]?.()
}

/**
 * Every file in a dependency set, concatenated with its path above it.
 *
 * The header comments are what make a single paste usable: without them the
 * reader has a wall of code and no idea which part belongs in which file.
 */
export async function bundleSource(paths: string[]): Promise<string> {
  const parts = await Promise.all(
    paths.map(async (path) => {
      const source = await loadSource(path)
      if (source === undefined) return null
      const rule = '─'.repeat(Math.max(8, 74 - path.length))
      return `// ${rule} ${path}\n\n${source.trimEnd()}\n`
    }),
  )
  return parts.filter(Boolean).join('\n')
}
