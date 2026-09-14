import { useEffect, useState } from 'react'
import { Surface, Text } from 'citrine'
import { Code, Pending, type PropRow } from './Doc'
import { cachedProps, loadProps, type GeneratedProps } from '../data/props'

/**
 * One component's generated API. Each is its own small chunk, usually already
 * here — the component page and the link prefetcher both ask for it early —
 * in which case the table renders on the first pass with no placeholder.
 */
function useProps(component: string): GeneratedProps | null | undefined {
  const [api, setApi] = useState(() => cachedProps(component))

  useEffect(() => {
    let live = true
    setApi(cachedProps(component))
    loadProps(component).then((loaded) => {
      if (live) setApi(loaded)
    })
    return () => {
      live = false
    }
  }, [component])

  return api
}

/**
 * The component's API, taken from its type.
 *
 * Names, types, defaults and required-ness are read off the AST at build time,
 * so the table cannot drift from the implementation the way a hand-maintained
 * one does. Prose is the one column a type cannot supply: it comes from the
 * JSDoc on the member, and falls back to whatever was written beside the
 * examples for the props that have none.
 */
export function ComponentApi({
  component,
  notes,
}: {
  component: string
  /** Hand-written rows, used only to fill in missing descriptions. */
  notes?: PropRow[]
}) {
  const api = useProps(component)
  if (api === undefined) return <Pending className="h-[260px]" />
  if (!api || api.props.length === 0) {
    return (
      <Text size="caption" tone="faint" leading="normal">
        {component} takes no props of its own
        {api?.inherits?.length ? ` beyond ${api.inherits.join(' and ')}.` : '.'}
      </Text>
    )
  }

  // Hand-written rows sometimes describe several props at once ("min / max"),
  // so index every name a row mentions rather than only its first.
  const declared = new Set(api.props.map((prop) => prop.name))
  const described = new Map<string, string>()
  const inherited: PropRow[] = []

  for (const note of notes ?? []) {
    const parts = note.name.split(/[\s/,|]+/).map((part) => part.trim()).filter(Boolean)
    if (parts.some((part) => declared.has(part))) {
      for (const part of parts) described.set(part, note.description)
    } else {
      // Prose for something the type does not declare — a forwarded ref, a
      // native attribute, the rest spread. Still real API, so still shown.
      inherited.push(note)
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Surface variant="card" className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {['Prop', 'Type', 'Default', 'Description'].map((heading) => (
                <th key={heading} className="px-4 py-3">
                  <Text
                    size="caption"
                    weight="bold"
                    tone="faint"
                    className="uppercase tracking-wider"
                  >
                    {heading}
                  </Text>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {api.props.map((prop) => (
              <tr key={prop.name} className="border-b border-line align-top last:border-0">
                <td className="px-4 py-3">
                  <span className="inline-flex items-baseline gap-1.5">
                    <Code>{prop.name}</Code>
                    {prop.required && (
                      <span
                        title="Required"
                        className="text-[10px] font-bold leading-none text-danger"
                      >
                        *
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-[11px] font-medium leading-relaxed text-ink-soft">
                    {prop.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {prop.defaultValue ? (
                    <span className="font-mono text-[11px] font-medium text-ink-faint">
                      {prop.defaultValue}
                    </span>
                  ) : (
                    <Text size="caption" tone="faint">
                      —
                    </Text>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Text size="caption" weight="medium" tone="soft" leading="normal">
                    {prop.description ?? described.get(prop.name) ?? ''}
                  </Text>
                </td>
              </tr>
            ))}

            {inherited.length > 0 && (
              <>
                <tr className="border-b border-line bg-surface-sunken">
                  <td colSpan={4} className="px-4 py-2">
                    <Text
                      size="micro"
                      weight="bold"
                      tone="faint"
                      className="uppercase tracking-[0.14em]"
                    >
                      Inherited
                    </Text>
                  </td>
                </tr>
                {inherited.map((row) => (
                  <tr key={row.name} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-3">
                      <Code>{row.name}</Code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] font-medium leading-relaxed text-ink-soft">
                        {row.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.defaultValue ? (
                        <span className="font-mono text-[11px] font-medium text-ink-faint">
                          {row.defaultValue}
                        </span>
                      ) : (
                        <Text size="caption" tone="faint">
                          —
                        </Text>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Text size="caption" weight="medium" tone="soft" leading="normal">
                        {row.description}
                      </Text>
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </Surface>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Text size="micro" tone="faint">
          <span className="font-bold text-danger">*</span> required
        </Text>
        {api.inherits?.map((base) => (
          <Text key={base} size="micro" tone="faint">
            plus every prop of <span className="font-mono">{base}</span>
          </Text>
        ))}
        <Text size="micro" tone="faint">
          Generated from the type.
        </Text>
      </div>
    </div>
  )
}
