'use client'

import { useId, useMemo, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { CodeBlock } from '../CodeBlock'
import { ChevronRightIcon } from '../internal/icons'
import { Text } from '../Text'

/** Any node of an OpenAPI 3 document. Deliberately loose: real documents are. */
export type OpenApiReferenceNode = { [key: string]: unknown }

/** An OpenAPI 3.x document, as parsed JSON or YAML. */
export interface OpenApiReferenceDocument {
  openapi: string
  info: { title: string; version: string; description?: string }
  servers?: { url: string; description?: string }[]
  tags?: { name: string; description?: string }[]
  paths: Record<string, OpenApiReferenceNode>
  components?: OpenApiReferenceNode
}

export interface OpenApiReferenceProps {
  /** The document to render. Local `$ref`s (`#/components/…`) are resolved; remote ones are shown by name. */
  document: OpenApiReferenceDocument
  /** Base URL for the curl snippet. Defaults to the first server. */
  baseUrl?: string
  /** Operation ids (or `METHOD path`) open on first render. */
  defaultOpen?: string[]
  /** Merged last, so it wins. */
  className?: string
}

const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options', 'trace'] as const

const METHOD_TONE: Record<string, string> = {
  get: 'bg-[color-mix(in_oklab,var(--color-success)_16%,transparent)] text-[color-mix(in_oklab,var(--color-success)_60%,var(--color-ink))]',
  post: 'bg-accent-soft text-[color-mix(in_oklab,var(--color-accent-strong)_45%,var(--color-ink))]',
  put: 'bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[color-mix(in_oklab,var(--color-warning)_45%,var(--color-ink))]',
  patch: 'bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[color-mix(in_oklab,var(--color-warning)_45%,var(--color-ink))]',
  delete: 'bg-[color-mix(in_oklab,var(--color-danger)_14%,transparent)] text-danger',
}

const isNode = (value: unknown): value is OpenApiReferenceNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Follows a local JSON pointer, decoding ~1 and ~0. Unknown or remote pointers return null. */
function pointer(document: OpenApiReferenceDocument, ref: string): OpenApiReferenceNode | null {
  if (!ref.startsWith('#/')) return null
  let node: unknown = document
  for (const raw of ref.slice(2).split('/')) {
    const key = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~')
    node = isNode(node) ? node[key] : undefined
  }
  return isNode(node) ? node : null
}

/** Dereferences a chain of $refs, stopping at a cycle or a dead end. */
function deref(document: OpenApiReferenceDocument, node: unknown, seen: string[] = []) {
  let current = node
  const trail = [...seen]
  while (isNode(current) && typeof current.$ref === 'string') {
    const ref = current.$ref
    if (trail.includes(ref)) return { node: null, ref, trail, circular: true }
    trail.push(ref)
    const next = pointer(document, ref)
    if (!next) return { node: null, ref, trail, circular: false }
    current = next
  }
  return { node: isNode(current) ? current : null, ref: trail[trail.length - 1], trail, circular: false }
}

const refName = (ref?: string) => (ref ? ref.split('/').pop() ?? ref : undefined)

/** Merges allOf members into one object schema. */
function flatten(document: OpenApiReferenceDocument, schema: OpenApiReferenceNode, trail: string[]): OpenApiReferenceNode {
  if (!Array.isArray(schema.allOf)) return schema
  const merged: OpenApiReferenceNode = { ...schema, allOf: undefined, type: schema.type ?? 'object', properties: {}, required: [] }
  for (const part of [schema, ...schema.allOf]) {
    const resolved = deref(document, part, trail).node
    if (!resolved) continue
    const flat = resolved === schema ? resolved : flatten(document, resolved, trail)
    Object.assign(merged.properties as object, flat.properties ?? {})
    ;(merged.required as string[]).push(...((flat.required as string[]) ?? []))
  }
  return merged
}

/** An example value built from the schema — example, default, first enum value, or a typed placeholder. */
function sample(document: OpenApiReferenceDocument, node: unknown, trail: string[] = [], depth = 0): unknown {
  const { node: raw, circular, trail: next } = deref(document, node, trail)
  if (!raw || circular || depth > 6) return circular ? {} : null
  const schema = flatten(document, raw, next)
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  if (Array.isArray(schema.enum)) return schema.enum[0]
  const variants = (schema.oneOf ?? schema.anyOf) as unknown[] | undefined
  if (variants?.length) return sample(document, variants[0], next, depth + 1)
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type
  if (type === 'array') return [sample(document, schema.items, next, depth + 1)]
  if (type === 'object' || schema.properties) {
    return Object.fromEntries(
      Object.entries((schema.properties as OpenApiReferenceNode) ?? {})
        .filter(([, value]) => !(isNode(value) && value.readOnly))
        .map(([key, value]) => [key, sample(document, value, next, depth + 1)]),
    )
  }
  if (type === 'integer' || type === 'number') return 0
  if (type === 'boolean') return true
  if (schema.format === 'date-time') return '2026-01-01T00:00:00Z'
  if (schema.format === 'email') return 'user@example.com'
  if (schema.format === 'uuid') return '3fa85f64-5717-4562-b3fc-2c963f66afa6'
  return 'string'
}

function describeType(schema: OpenApiReferenceNode | null, ref?: string): string {
  if (!schema) return refName(ref) ?? 'any'
  const type = Array.isArray(schema.type) ? schema.type.join(' | ') : (schema.type as string | undefined)
  const base = type ?? (schema.properties || schema.allOf ? 'object' : schema.oneOf ? 'oneOf' : schema.anyOf ? 'anyOf' : 'any')
  const format = schema.format ? `<${String(schema.format)}>` : ''
  return `${base}${format}${schema.nullable ? ' | null' : ''}`
}

const Mono = ({ children, className }: { children: ReactNode; className?: string }) => (
  <code className={cn('font-mono text-[12px] font-semibold', className)}>{children}</code>
)

interface SchemaViewProps {
  document: OpenApiReferenceDocument
  schema: unknown
  trail: string[]
  depth: number
}

/** Renders a schema as a nested property list. Circular references stop at the second visit. */
function SchemaView({ document, schema: input, trail, depth }: SchemaViewProps) {
  const { node, ref, circular, trail: next } = deref(document, input, trail)
  if (circular) return <Text size="caption" tone="faint">{`↻ ${refName(ref)} (circular — shown above)`}</Text>
  if (!node) return <Text size="caption" tone="faint">{ref ? `${refName(ref)} (unresolved reference)` : 'any'}</Text>
  const schema = flatten(document, node, next)
  const variants = (schema.oneOf ?? schema.anyOf) as unknown[] | undefined
  const properties = isNode(schema.properties) ? Object.entries(schema.properties) : []
  const required = new Set((schema.required as string[]) ?? [])

  if (variants?.length) {
    return (
      <div className="flex flex-col gap-2">
        <Text size="caption" tone="faint">{schema.oneOf ? 'One of' : 'Any of'}</Text>
        {variants.map((variant, index) => (
          <div key={index} className="border-l-2 border-line pl-3">
            <SchemaView document={document} schema={variant} trail={next} depth={depth + 1} />
          </div>
        ))}
      </div>
    )
  }

  if (schema.type === 'array') {
    const items = deref(document, schema.items, next)
    return (
      <div className="flex flex-col gap-1.5">
        <Text size="caption" tone="soft">{`Array of ${describeType(items.node, items.ref)}${items.ref ? ` (${refName(items.ref)})` : ''}`}</Text>
        {(items.node?.properties || items.node?.allOf || items.node?.oneOf || items.circular) && (
          <div className="border-l-2 border-line pl-3">
            <SchemaView document={document} schema={schema.items} trail={next} depth={depth + 1} />
          </div>
        )}
      </div>
    )
  }

  if (!properties.length) {
    return (
      <Text size="caption" tone="soft">
        <Mono>{describeType(schema, ref)}</Mono>
        {Array.isArray(schema.enum) && ` — one of ${schema.enum.map((value) => JSON.stringify(value)).join(', ')}`}
      </Text>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-line">
      {properties.map(([name, value]) => {
        const child = deref(document, value, next)
        const nested = child.node && (child.node.properties || child.node.allOf || child.node.type === 'array' || child.node.oneOf || child.node.anyOf)
        const summary = (
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Mono className="text-ink">{name}</Mono>
            <Mono className="font-medium text-ink-faint">
              {child.circular ? refName(child.ref) : describeType(child.node, child.ref)}
            </Mono>
            {required.has(name) && <Text as="span" size="micro" tone="danger">required</Text>}
            {child.node?.readOnly === true && <Text as="span" size="micro" tone="faint">read-only</Text>}
          </span>
        )
        const detail = (
          <>
            {typeof child.node?.description === 'string' && (
              <Text size="caption" tone="soft" leading="normal">{child.node.description}</Text>
            )}
            {Array.isArray(child.node?.enum) && (
              <Text size="caption" tone="faint">{`One of ${child.node.enum.map((item) => JSON.stringify(item)).join(', ')}`}</Text>
            )}
          </>
        )
        return (
          <li key={name} className="flex flex-col gap-1 py-2">
            {nested || child.circular ? (
              <details open={depth < 1} className="group flex flex-col gap-1">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-[6px] [&::-webkit-details-marker]:hidden">
                  <ChevronRightIcon size={12} className="shrink-0 text-ink-faint transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                  {summary}
                </summary>
                <div className="mt-1 flex flex-col gap-1 border-l-2 border-line pl-3">
                  {detail}
                  <SchemaView document={document} schema={value} trail={next} depth={depth + 1} />
                </div>
              </details>
            ) : (
              <>
                {summary}
                {detail}
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}

interface Operation {
  key: string
  method: string
  path: string
  node: OpenApiReferenceNode
  parameters: OpenApiReferenceNode[]
}

const quote = (text: string) => `'${text.replace(/'/g, `'\\''`)}'`

function curl(document: OpenApiReferenceDocument, operation: Operation, baseUrl: string) {
  let path = operation.path
  const query: string[] = []
  const headers: string[] = []
  for (const parameter of operation.parameters) {
    const name = String(parameter.name)
    const value = parameter.example ?? sample(document, parameter.schema)
    if (parameter.in === 'path') path = path.replace(`{${name}}`, encodeURIComponent(String(value ?? `{${name}}`)))
    else if (parameter.in === 'query' && parameter.required) query.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`)
    else if (parameter.in === 'header' && parameter.required) headers.push(`-H ${quote(`${name}: ${String(value)}`)}`)
  }
  const lines = [`curl -X ${operation.method.toUpperCase()} ${quote(`${baseUrl.replace(/\/$/, '')}${path}${query.length ? `?${query.join('&')}` : ''}`)}`]
  lines.push(...headers)
  const body = deref(document, operation.node.requestBody).node
  const content = isNode(body?.content) ? body.content : null
  const type = content ? Object.keys(content).find((key) => key.includes('json')) ?? Object.keys(content)[0] : null
  if (content && type) {
    const media = content[type] as OpenApiReferenceNode
    const example = media.example ?? sample(document, media.schema)
    lines.push(`-H ${quote(`Content-Type: ${type}`)}`)
    lines.push(`-d ${quote(type.includes('json') ? JSON.stringify(example, null, 2) : String(example))}`)
  }
  return lines.join(' \\\n  ')
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <Text as="h6" size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
        {title}
      </Text>
      {children}
    </section>
  )
}

function OperationView({ document, operation, baseUrl, open, onToggle }: { document: OpenApiReferenceDocument; operation: Operation; baseUrl: string; open: boolean; onToggle: () => void }) {
  const panel = useId()
  const { node, method, path } = operation
  const body = deref(document, node.requestBody).node
  const bodyContent = isNode(body?.content) ? Object.entries(body.content) : []
  const responses = isNode(node.responses) ? Object.entries(node.responses) : []

  return (
    <div className="rounded-[var(--radius-tile)] border border-line bg-surface">
      <Text as="h5" size="body" className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={onToggle}
          className="flex w-full items-center gap-3 rounded-[var(--radius-tile)] px-3 py-2.5 text-left hover:bg-surface-muted"
        >
          <span className={cn('w-16 shrink-0 rounded-[6px] py-1 text-center font-mono text-[11px] font-bold uppercase', METHOD_TONE[method] ?? 'bg-surface-muted text-ink-soft')}>
            {method}
          </span>
          <Mono className={cn('min-w-0 break-all text-ink', node.deprecated === true && 'line-through')}>{path}</Mono>
          {typeof node.summary === 'string' && <span className="hidden min-w-0 truncate text-[12px] font-medium text-ink-soft sm:block">{node.summary}</span>}
          <ChevronRightIcon size={14} className={cn('ml-auto shrink-0 text-ink-faint transition-transform motion-reduce:transition-none', open && 'rotate-90')} />
        </button>
      </Text>
      {open && (
        <div id={panel} className="flex flex-col gap-5 border-t border-line p-4">
          {typeof node.description === 'string' && <Text size="label" tone="soft" leading="normal">{node.description}</Text>}
          {operation.parameters.length > 0 && (
            <Section title="Parameters">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-line text-ink-faint">
                      {['Name', 'In', 'Type', 'Description'].map((heading) => (
                        <th key={heading} scope="col" className="py-1.5 pr-3 font-semibold">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {operation.parameters.map((parameter) => {
                      const schema = deref(document, parameter.schema)
                      return (
                        <tr key={`${parameter.in}-${parameter.name}`} className="border-b border-line align-top last:border-b-0">
                          <td className="py-2 pr-3">
                            <Mono className="text-ink">{String(parameter.name)}</Mono>
                            {parameter.required === true && <span className="ml-1.5 text-[10px] font-bold text-danger">required</span>}
                          </td>
                          <td className="py-2 pr-3 text-ink-soft">{String(parameter.in)}</td>
                          <td className="py-2 pr-3"><Mono className="font-medium text-ink-soft">{describeType(schema.node, schema.ref)}</Mono></td>
                          <td className="py-2 text-ink-soft">
                            {typeof parameter.description === 'string' ? parameter.description : '—'}
                            {Array.isArray(schema.node?.enum) && <span className="block text-ink-faint">{`One of ${schema.node.enum.join(', ')}`}</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
          {bodyContent.map(([type, media]) => (
            <Section key={type} title={`Request body · ${type}${body?.required ? ' · required' : ''}`}>
              <SchemaView document={document} schema={(media as OpenApiReferenceNode).schema} trail={[]} depth={0} />
            </Section>
          ))}
          {responses.length > 0 && (
            <Section title="Responses">
              <ul className="flex flex-col gap-3">
                {responses.map(([status, raw]) => {
                  const response = deref(document, raw).node
                  const media = isNode(response?.content) ? Object.entries(response.content)[0] : undefined
                  return (
                    <li key={status} className="flex flex-col gap-1.5">
                      <span className="flex items-baseline gap-2">
                        <Mono className={cn(status.startsWith('2') ? 'text-success' : status.startsWith('4') || status.startsWith('5') ? 'text-danger' : 'text-ink')}>
                          {status}
                        </Mono>
                        <Text as="span" size="label" tone="soft">{String(response?.description ?? '')}</Text>
                      </span>
                      {media && isNode(media[1]) && media[1].schema !== undefined && (
                        <div className="ml-1 border-l-2 border-line pl-3">
                          <SchemaView document={document} schema={media[1].schema} trail={[]} depth={1} />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}
          <Section title="Example request">
            <CodeBlock code={curl(document, operation, baseUrl)} language="bash" />
          </Section>
        </div>
      )}
    </div>
  )
}

/**
 * An API reference drawn straight from the OpenAPI document, so the docs cannot
 * drift from the spec they describe.
 *
 * Operations are grouped by their first tag, in the order the document lists
 * its tags. Each opens to its parameters, request body, responses and a curl
 * command generated from the operation itself — path parameters filled from
 * their examples, required query and header parameters included, and a body
 * built from the schema. Local `$ref`s are resolved as they are rendered; a
 * schema that refers back to itself (a tree node, a comment with replies) is
 * shown once and then marked circular instead of recursing forever. Deeper
 * levels start collapsed, because a response schema six levels deep is
 * unreadable fully open.
 */
export function OpenApiReference({ document, baseUrl, defaultOpen = [], className }: OpenApiReferenceProps) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpen))
  const server = baseUrl ?? document.servers?.[0]?.url ?? ''

  const groups = useMemo(() => {
    const byTag = new Map<string, Operation[]>()
    for (const tag of document.tags ?? []) byTag.set(tag.name, [])
    for (const [path, rawItem] of Object.entries(document.paths)) {
      const item = deref(document, rawItem).node
      if (!item) continue
      const shared = Array.isArray(item.parameters) ? item.parameters : []
      for (const method of METHODS) {
        const node = item[method]
        if (!isNode(node)) continue
        // Operation parameters override path-level ones with the same name and location.
        const merged = new Map<string, OpenApiReferenceNode>()
        for (const raw of [...shared, ...(Array.isArray(node.parameters) ? node.parameters : [])]) {
          const parameter = deref(document, raw).node
          if (parameter) merged.set(`${parameter.in}:${parameter.name}`, parameter)
        }
        const tag = (Array.isArray(node.tags) && typeof node.tags[0] === 'string' ? node.tags[0] : 'Other') as string
        const key = typeof node.operationId === 'string' ? node.operationId : `${method.toUpperCase()} ${path}`
        byTag.set(tag, [...(byTag.get(tag) ?? []), { key, method, path, node, parameters: [...merged.values()] }])
      }
    }
    return [...byTag].filter(([, operations]) => operations.length > 0)
  }, [document])

  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className={cn('flex min-w-0 flex-col gap-6', className)}>
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <Text as="h3" size="subtitle">{document.info.title}</Text>
          <Text as="span" size="caption" tone="faint" className="font-mono">{`v${document.info.version} · OpenAPI ${document.openapi}`}</Text>
        </div>
        {document.info.description && <Text size="label" tone="soft" leading="normal">{document.info.description}</Text>}
        {server && <Mono className="font-medium text-ink-faint">{server}</Mono>}
      </header>
      {groups.map(([tag, operations]) => (
        <section key={tag} className="flex flex-col gap-2">
          <Text as="h4" size="heading">{tag}</Text>
          {document.tags?.find((entry) => entry.name === tag)?.description && (
            <Text size="caption" tone="soft">{document.tags.find((entry) => entry.name === tag)?.description}</Text>
          )}
          <div className="flex flex-col gap-2">
            {operations.map((operation) => (
              <OperationView
                key={operation.key}
                document={document}
                operation={operation}
                baseUrl={server}
                open={open.has(operation.key)}
                onToggle={() => toggle(operation.key)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
