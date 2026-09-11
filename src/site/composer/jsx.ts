/**
 * Printing JSX as text — just enough of a formatter for the Composer's output
 * to read like code a person wrote: attributes on one line until they do not
 * fit, then one per line; short text children inline; everything else nested.
 */
const INDENT = '  '

export function attr(name: string, value: string | number | boolean): string {
  if (value === true) return name
  if (typeof value === 'number' || value === false) return `${name}={${value}}`
  return /["{}<>\\\n]/.test(value) ? `${name}={${JSON.stringify(value)}}` : `${name}="${value}"`
}

/** Text as a JSX child, wrapped in an expression when JSX would misread it. */
export function text(value: string): string {
  return /[{}<>]/.test(value) || value !== value.trim() ? `{${JSON.stringify(value)}}` : value
}

/** `style={{ display: 'flex', gap: 12 }}` */
export function styleAttr(style: Record<string, string | number>): string {
  const body = Object.entries(style)
    .map(([key, value]) => `${key}: ${typeof value === 'number' ? value : `'${value}'`}`)
    .join(', ')
  return `style={{ ${body} }}`
}

export function element(tag: string, attrs: string[], children: string[] = []): string[] {
  const inline = attrs.length > 0 ? `<${tag} ${attrs.join(' ')}` : `<${tag}`
  const wrap = inline.length > 76
  const open = wrap ? [`<${tag}`, ...attrs.map((line) => INDENT + line)] : [inline]

  if (children.length === 0) return wrap ? [...open, '/>'] : [`${inline} />`]

  const only = children[0]
  if (!wrap && children.length === 1 && only !== undefined && !only.startsWith('<') && inline.length + only.length < 88) {
    return [`${inline}>${only}</${tag}>`]
  }

  return [...(wrap ? [...open, '>'] : [`${inline}>`]), ...children.map((line) => INDENT + line), `</${tag}>`]
}

export const indentLines = (lines: string[], depth: number) => lines.map((line) => INDENT.repeat(depth) + line)
