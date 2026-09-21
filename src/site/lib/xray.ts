/**
 * What component is this?
 *
 * Every element on a screen was rendered by something, and React still knows
 * what. This reads that back: from a DOM node it walks up React's own tree and
 * names each component on the way out, so pointing at a control names the
 * control, the field around it and the card around that.
 *
 * The names come from the rendered functions themselves, which is why the site
 * is built with `keepNames` (see vite.config.ts) — without it a production
 * build would mangle them to a letter. Each one is checked against the
 * catalogue before it is shown, so an internal helper or one of the site's own
 * wrappers never appears: only components a reader can go and look up.
 */

/** The chain from the element outwards: the innermost component first. */
export type XrayChain = string[]

interface Fiber {
  return: Fiber | null
  type: unknown
  elementType: unknown
}

/** React hangs its tree off the DOM node under a key it generates per build. */
function fiberOf(node: Element): Fiber | null {
  for (const key in node) {
    if (key.startsWith('__reactFiber$')) return (node as unknown as Record<string, Fiber>)[key]
  }
  return null
}

/**
 * The name React has for a rendered type.
 *
 * `forwardRef` and `memo` wrap a component in an object rather than naming it,
 * so the wrapped function is where the name actually is.
 */
function nameOf(type: unknown): string | null {
  if (typeof type === 'function') return (type as { displayName?: string; name?: string }).displayName ?? (type as { name?: string }).name ?? null
  if (type && typeof type === 'object') {
    const wrapper = type as { displayName?: string; render?: unknown; type?: unknown }
    if (wrapper.displayName) return wrapper.displayName
    return nameOf(wrapper.render ?? wrapper.type)
  }
  return null
}

/**
 * The library components that rendered this element, innermost first.
 *
 * Repeats are folded away: a component that renders another element of itself
 * would otherwise print its own name three times up the chain, which says
 * nothing. `limit` keeps the label to something readable.
 */
export function chainAt(node: Element, known: ReadonlySet<string>, limit = 4): XrayChain {
  let fiber = fiberOf(node)
  const chain: XrayChain = []
  while (fiber && chain.length < limit) {
    const name = resolve(nameOf(fiber.elementType) ?? nameOf(fiber.type), known)
    if (name && chain[chain.length - 1] !== name) chain.push(name)
    fiber = fiber.return
  }
  return chain
}

/**
 * The catalogue name behind what a bundler called the function.
 *
 * A bundler renames a function when two modules in one chunk share a name:
 * `Input` becomes `Input2`. The exact name is tried first, so a component
 * whose name really does end in digits — Game2048 — is never mistaken for a
 * renamed one, and only then is a numeric suffix taken off.
 */
function resolve(name: string | null, known: ReadonlySet<string>): string | null {
  if (!name) return null
  if (known.has(name)) return name
  const stripped = name.replace(/\d+$/, '')
  return stripped !== name && known.has(stripped) ? stripped : null
}
