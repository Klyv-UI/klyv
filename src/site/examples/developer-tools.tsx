import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  A11yInspector,
  AccessExplainer,
  Button,
  DataProfile,
  EmailViewer,
  ExperimentResults,
  HexViewer,
  OpenApiReference,
  PasskeyManager,
  SegmentedControl,
  StackTrace,
  Text,
  WebVitals,
  type AccessExplainerPolicy,
  type EmailViewerAttachment,
  type ExperimentResultsVariant,
  type HexViewerSelection,
  type OpenApiReferenceDocument,
  type PasskeyManagerCreated,
  type PasskeyManagerPasskey,
  type WebVitalsMetric,
} from 'klyvui'
import type { ExampleModule } from './types'
import { rationale } from './shared'

const DAY = 86_400_000

function Note({ children }: { children: ReactNode }) {
  return (
    <Text size="caption" tone="faint" leading="normal">
      {children}
    </Text>
  )
}

/** A small deterministic generator, so demos look the same on every load. */
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

/* ------------------------------------------------------------ hex viewer */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

const crc32 = (bytes: number[]) => {
  let c = 0xffffffff
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const u32 = (value: number) => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]
const ascii = (text: string) => Array.from(text, (character) => character.charCodeAt(0))

/** A well-formed PNG header: signature, IHDR, a tEXt chunk, some IDAT, IEND — real CRCs throughout. */
function pngBytes() {
  const random = seeded(7)
  const out = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const chunk = (type: string, data: number[]) => {
    const body = [...ascii(type), ...data]
    out.push(...u32(data.length), ...body, ...u32(crc32(body)))
  }
  chunk('IHDR', [...u32(640), ...u32(480), 8, 6, 0, 0, 0])
  chunk('tEXt', [...ascii('Software'), 0, ...ascii('Klyv HexViewer demo')])
  chunk('IDAT', [0x78, 0x9c, ...Array.from({ length: 180 }, () => Math.floor(random() * 256))])
  chunk('IEND', [])
  return new Uint8Array(out)
}

/** One mebibyte of records — enough to show that only the visible rows exist. */
function largeBuffer() {
  const bytes = new Uint8Array(1 << 20)
  const random = seeded(42)
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const label = ascii(`REC#${(offset / 64).toString().padStart(6, '0')} `)
    bytes.set(label, offset)
    for (let index = label.length; index < 64; index += 1) bytes[offset + index] = Math.floor(random() * 256)
  }
  return bytes
}

function HexExample() {
  const data = useMemo(pngBytes, [])
  const [selection, setSelection] = useState<HexViewerSelection>({ start: 0, end: 7 })
  return (
    <div className="flex w-full flex-col gap-3">
      <HexViewer data={data} label="PNG file bytes" defaultSelection={{ start: 0, end: 7 }} onSelectionChange={setSelection} />
      <Note>{`onSelectionChange: bytes ${selection.start}–${selection.end}. The first eight are the PNG signature; try selecting “IHDR” in the ASCII column.`}</Note>
    </div>
  )
}

function HexLargeExample() {
  const data = useMemo(largeBuffer, [])
  return <HexViewer data={data} label="One mebibyte of records" rows={10} defaultBytesPerRow={32} className="w-full" />
}

/* ------------------------------------------------------------- open api */

const TASKS_API: OpenApiReferenceDocument = {
  openapi: '3.1.0',
  info: { title: 'Tasks API', version: '2.4.0', description: 'Projects, and the tasks inside them. All requests need a bearer token.' },
  servers: [{ url: 'https://api.tasks.example/v2' }],
  tags: [
    { name: 'Tasks', description: 'Create, read and complete work items.' },
    { name: 'Projects', description: 'Containers for tasks, with their own members.' },
  ],
  paths: {
    '/projects/{projectId}/tasks': {
      parameters: [{ $ref: '#/components/parameters/ProjectId' }],
      get: {
        tags: ['Tasks'],
        operationId: 'listTasks',
        summary: 'List tasks in a project',
        parameters: [
          { name: 'status', in: 'query', description: 'Only tasks in this state.', schema: { $ref: '#/components/schemas/TaskStatus' } },
          { name: 'limit', in: 'query', description: 'Page size, 1–100.', schema: { type: 'integer', default: 25 } },
          { name: 'cursor', in: 'query', description: 'From the previous page’s next_cursor.', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'A page of tasks',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
                    next_cursor: { type: 'string', nullable: true, description: 'Null on the last page.' },
                  },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      post: {
        tags: ['Tasks'],
        operationId: 'createTask',
        summary: 'Create a task',
        description: 'Creates a task at the bottom of the project. Pass parent_id to create a subtask.',
        parameters: [{ name: 'Idempotency-Key', in: 'header', required: true, description: 'Retries with the same key create one task.', schema: { type: 'string', example: 'b7e4c1d2' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskInput' } } } },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          '422': { $ref: '#/components/responses/Invalid' },
        },
      },
    },
    '/tasks/{taskId}': {
      parameters: [{ name: 'taskId', in: 'path', required: true, schema: { type: 'string', example: 'tsk_82hd' } }],
      patch: {
        tags: ['Tasks'],
        operationId: 'updateTask',
        summary: 'Update a task',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskInput' } } } },
        responses: { '200': { description: 'The updated task', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } }, '404': { $ref: '#/components/responses/NotFound' } },
      },
      delete: {
        tags: ['Tasks'],
        operationId: 'deleteTask',
        summary: 'Delete a task and its subtasks',
        responses: { '204': { description: 'Deleted' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/projects/{projectId}': {
      parameters: [{ $ref: '#/components/parameters/ProjectId' }],
      get: {
        tags: ['Projects'],
        operationId: 'getProject',
        summary: 'Get a project',
        responses: { '200': { description: 'The project', content: { 'application/json': { schema: { $ref: '#/components/schemas/Project' } } } }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
  },
  components: {
    parameters: {
      ProjectId: { name: 'projectId', in: 'path', required: true, description: 'The project’s id.', schema: { type: 'string', example: 'prj_4k2m' } },
    },
    schemas: {
      TaskStatus: { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'Where the task is.' },
      User: {
        type: 'object',
        required: ['id', 'name'],
        properties: { id: { type: 'string', readOnly: true }, name: { type: 'string', example: 'Priya Raman' }, email: { type: 'string', format: 'email' } },
      },
      TaskInput: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', example: 'Draft the Q3 roadmap', description: 'One line, up to 200 characters.' },
          status: { $ref: '#/components/schemas/TaskStatus' },
          due: { type: 'string', format: 'date-time' },
          assignee_id: { type: 'string', nullable: true },
          parent_id: { type: 'string', description: 'Makes this a subtask.' },
          labels: { type: 'array', items: { type: 'string' }, example: ['planning'] },
        },
      },
      Task: {
        allOf: [
          { $ref: '#/components/schemas/TaskInput' },
          {
            type: 'object',
            required: ['id', 'created_at'],
            properties: {
              id: { type: 'string', readOnly: true, example: 'tsk_82hd' },
              created_at: { type: 'string', format: 'date-time', readOnly: true },
              assignee: { $ref: '#/components/schemas/User' },
              subtasks: { type: 'array', description: 'Tasks nested under this one — the schema refers to itself.', items: { $ref: '#/components/schemas/Task' } },
            },
          },
        ],
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          owner: { $ref: '#/components/schemas/User' },
          visibility: { type: 'string', enum: ['private', 'workspace', 'public'] },
        },
      },
      Error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' }, field: { type: 'string', nullable: true } } },
    },
    responses: {
      NotFound: { description: 'No such resource, or no access to it', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      Invalid: { description: 'The body failed validation', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    },
  },
}

/* ------------------------------------------------------------ stack trace */

const V8_TRACE = `TypeError: Cannot read properties of undefined (reading 'price')
    at lineTotal (webpack://shop/src/cart/totals.ts:14:23)
    at Array.map (<anonymous>)
    at cartTotal (webpack://shop/src/cart/totals.ts:22:30)
    at CartSummary (webpack://shop/src/components/CartSummary.tsx:12:17)
    at renderWithHooks (webpack://shop/node_modules/react-dom/cjs/react-dom.development.js:16305:18)
    at mountIndeterminateComponent (webpack://shop/node_modules/react-dom/cjs/react-dom.development.js:20074:13)
    at beginWork (webpack://shop/node_modules/react-dom/cjs/react-dom.development.js:21587:16)
    at HTMLUnknownElement.callCallback (webpack://shop/node_modules/react-dom/cjs/react-dom.development.js:4164:14)
    at Object.invokeGuardedCallbackDev (webpack://shop/node_modules/react-dom/cjs/react-dom.development.js:4213:16)
    at performUnitOfWork (webpack://shop/node_modules/react-dom/cjs/react-dom.development.js:26557:12)
    at workLoopSync (webpack://shop/node_modules/react-dom/cjs/react-dom.development.js:26466:5)
    at async checkout (webpack://shop/src/pages/checkout.tsx:58:5)`

const SOURCES: Record<string, string> = {
  'webpack://shop/src/cart/totals.ts': `import type { CartLine, Catalog } from './types'

/**
 * Totals are computed from the catalogue at render time, so a price change
 * shows up in open carts without a refresh.
 */
export interface Totals {
  subtotal: number
  items: number
}

export function lineTotal(line: CartLine, catalog: Catalog): number {
  const product = catalog[line.sku]
  return product.price * line.quantity
}

export function cartTotal(lines: CartLine[], catalog: Catalog): Totals {
  // A SKU removed from the catalogue while it sat in a cart has no entry here,
  // and lineTotal does not check for that.
  return {
    items: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.map((line) => lineTotal(line, catalog)).reduce((a, b) => a + b, 0),
  }
}`,
  'webpack://shop/src/components/CartSummary.tsx': `import { useCart } from '../cart/useCart'
import { useCatalog } from '../catalog/useCatalog'
import { cartTotal } from '../cart/totals'
import { formatPrice } from '../format'

export function CartSummary() {
  const { lines } = useCart()
  const catalog = useCatalog()

  if (!lines.length) return <p>Your cart is empty.</p>

  const { subtotal, items } = cartTotal(lines, catalog)
  return (
    <dl>
      <dt>Items</dt>
      <dd>{items}</dd>
      <dt>Subtotal</dt>
      <dd>{formatPrice(subtotal)}</dd>
    </dl>
  )
}`,
}

const getSource = (file: string) =>
  new Promise<string | undefined>((resolve) => setTimeout(() => resolve(SOURCES[file]), 180))

const PYTHON_TRACE = `Traceback (most recent call last):
  File "/app/.venv/lib/python3.12/site-packages/django/core/handlers/exception.py", line 55, in inner
    response = get_response(request)
  File "/app/.venv/lib/python3.12/site-packages/django/core/handlers/base.py", line 197, in _get_response
    response = wrapped_callback(request, *callback_args, **callback_kwargs)
  File "/app/.venv/lib/python3.12/site-packages/django/views/decorators/http.py", line 43, in inner
    return func(request, *args, **kwargs)
  File "/app/billing/views.py", line 42, in create_invoice
    invoice = build_invoice(customer, items)
  File "/app/billing/invoices.py", line 88, in build_invoice
    subtotal = sum(line.amount for line in items)
  File "/app/billing/invoices.py", line 88, in <genexpr>
    subtotal = sum(line.amount for line in items)
AttributeError: 'dict' object has no attribute 'amount'`

const FIREFOX_TRACE = `TypeError: product is undefined
lineTotal@https://shop.example/assets/cart-3f9a.js:14:23
cartTotal/subtotal<@https://shop.example/assets/cart-3f9a.js:22:30
cartTotal@https://shop.example/assets/cart-3f9a.js:22:18
dispatch@https://shop.example/node_modules/.vite/deps/redux.js:301:12
@https://shop.example/assets/main-81c2.js:5:1`

function TraceExample() {
  const [format, setFormat] = useState<'v8' | 'python' | 'firefox'>('v8')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Trace format"
        size="sm"
        value={format}
        onValueChange={setFormat}
        options={[
          { value: 'v8', label: 'Chrome / Node' },
          { value: 'python', label: 'Python' },
          { value: 'firefox', label: 'Firefox / Safari' },
        ]}
      />
      <StackTrace
        key={format}
        trace={format === 'v8' ? V8_TRACE : format === 'python' ? PYTHON_TRACE : FIREFOX_TRACE}
        getSource={format === 'v8' ? getSource : undefined}
      />
      <Note>
        {format === 'v8'
          ? 'Source for totals.ts and CartSummary.tsx comes from getSource after a short delay; checkout.tsx has none, and says so.'
          : format === 'python'
            ? 'No getSource here — Python quotes each line in the traceback, and that line is shown instead.'
            : 'Firefox and Safari print frames as name@url:line:column, with no “at”.'}
      </Note>
    </div>
  )
}

/* -------------------------------------------------------------- web vitals */

function VitalsExample() {
  const [log, setLog] = useState<WebVitalsMetric[]>([])
  const [banners, setBanners] = useState(0)
  const [pending, setPending] = useState(false)

  const shift = () => {
    setPending(true)
    // Shifts within 500ms of input are excluded from CLS by definition, so the
    // banner arrives later — the way a late ad or cookie notice does.
    window.setTimeout(() => {
      setBanners((count) => count + 1)
      setPending(false)
    }, 900)
  }

  const slow = () => {
    const until = performance.now() + 320
    while (performance.now() < until) {
      // Block the main thread, as a heavy click handler would.
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={shift} loading={pending}>
          Insert a late banner
        </Button>
        <Button size="sm" variant="outline" onClick={slow}>
          Run a slow click handler
        </Button>
      </div>
      {Array.from({ length: banners }, (_, index) => (
        <div key={index} className="rounded-[var(--radius-tile)] bg-accent-soft px-4 py-6 text-[13px] font-semibold">
          {`Late banner ${index + 1} — everything below it just moved.`}
        </div>
      ))}
      <WebVitals onReport={(metric) => setLog((current) => [metric, ...current].slice(0, 4))} />
      <Note>
        {log.length
          ? `onReport: ${log.map((metric) => `${metric.name} ${metric.name === 'CLS' ? metric.value.toFixed(3) : Math.round(metric.value)}`).join(' · ')}`
          : 'onReport fires as each value arrives.'}
      </Note>
    </div>
  )
}

/* ----------------------------------------------------------- a11y inspector */

const PRODUCT_IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="60"><rect width="96" height="60" rx="8" fill="#e6ecf5"/><circle cx="30" cy="30" r="14" fill="#8aa4c8"/><rect x="52" y="20" width="30" height="20" rx="4" fill="#b8c7de"/></svg>')

const SAMPLE_CSS = `
.sample{display:grid;gap:10px;padding:18px;border-radius:14px;background:#ffffff;color:#1d1d1f;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:420px}
.sample h2{font-size:18px;margin:0}.sample h4{font-size:14px;margin:4px 0 0}
.sample label{display:grid;gap:4px;font-weight:600;font-size:12px}
.sample input{height:34px;border:1px solid #c9c9cf;border-radius:8px;padding:0 10px;font:inherit}
.sample .row{display:flex;gap:8px;align-items:center}
.sample .icon{width:34px;height:34px;border-radius:999px;border:1px solid #c9c9cf;background:#f4f4f6;display:grid;place-items:center}
.sample .pay{height:36px;border-radius:999px;border:0;background:#1d1d1f;color:#ffffff;font-weight:700;padding:0 16px}
.sample .fine{color:#b4b4b8;font-size:12px;margin:0}
`

/**
 * The deliberately broken form lives in a closed shadow root. That keeps it out
 * of this site’s own automated audit — which would otherwise fail the page for
 * the very problems the demo exists to show — while the inspector, handed a
 * direct reference, audits it like any other subtree.
 */
function BrokenSample({ onReady }: { onReady: (node: HTMLDivElement | null) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const shadow = useRef<ShadowRoot | null>(null)
  const [root, setRoot] = useState<ShadowRoot | null>(null)

  // A closed root cannot be looked up again, and a host takes only one, so it
  // is kept in a ref that survives Strict Mode’s second effect run.
  useEffect(() => {
    if (host.current && !shadow.current) shadow.current = host.current.attachShadow({ mode: 'closed' })
    setRoot(shadow.current)
  }, [])

  return (
    <div ref={host}>
      {root &&
        createPortal(
          <>
            <style>{SAMPLE_CSS}</style>
            <div ref={onReady} className="sample">
              <h2>Checkout</h2>
              <div className="row">
                <img src={PRODUCT_IMAGE} width={96} height={60} />
                <span id="line-total">Desk lamp · $48.00</span>
              </div>
              <h4>Delivery</h4>
              <label>
                Email
                <input type="email" defaultValue="ada@example.com" />
              </label>
              <input type="text" defaultValue="221B Baker Street" />
              <p className="fine">Free returns within 30 days.</p>
              <div className="row">
                <button type="button" className="icon">
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="#1d1d1f" strokeWidth="2" fill="none" />
                  </svg>
                </button>
                <a href="#terms" className="icon">
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="8" r="6" stroke="#1d1d1f" strokeWidth="2" fill="none" />
                  </svg>
                </a>
                <button type="button" className="pay" tabIndex={3}>
                  Pay now
                </button>
                <span id="line-total">$48.00</span>
              </div>
            </div>
          </>,
          root,
        )}
    </div>
  )
}

function InspectorExample() {
  const target = useRef<HTMLDivElement | null>(null)
  const [ready, setReady] = useState(false)
  return (
    <div className="grid w-full grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="flex flex-col gap-2">
        <Text size="caption" weight="semibold" tone="faint">
          Deliberately broken sample
        </Text>
        <BrokenSample
          onReady={(node) => {
            target.current = node
            if (node) setReady(true)
          }}
        />
      </div>
      {ready && <A11yInspector target={target} />}
    </div>
  )
}

/* -------------------------------------------------------------- email viewer */

const CHART =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120"><rect width="360" height="120" fill="#f6f7f9"/><g fill="#7c8cff"><rect x="20" y="70" width="36" height="40"/><rect x="76" y="52" width="36" height="58"/><rect x="132" y="60" width="36" height="50"/><rect x="188" y="34" width="36" height="76"/><rect x="244" y="24" width="36" height="86"/><rect x="300" y="12" width="36" height="98"/></g></svg>')

const CSV = 'data:text/csv;charset=utf-8,' + encodeURIComponent('month,api_calls\n2026-04,182004\n2026-05,240115\n2026-06,301882\n')

const ATTACHMENTS: EmailViewerAttachment[] = [
  { name: 'usage-q2.csv', size: 38_912, type: 'text/csv', href: CSV },
  { name: 'Q2-invoice-4471.pdf', size: 186_400, type: 'application/pdf' },
  { name: 'chart.svg', size: 612, contentId: 'usage-chart', href: CHART },
]

/** Remote resources point at this site’s own favicon, so “Show images” never reaches a third party. */
function emailHtml(origin: string) {
  return `<style>
  .card{border:1px solid #e3e5ea;border-radius:10px;padding:16px;background:#ffffff url(${origin}/favicon.svg?bg) no-repeat right 12px top 12px / 24px}
  h1{font-size:18px;margin:0 0 8px}
  .cta{display:inline-block;background:#1d1d1f;color:#ffffff;padding:8px 14px;border-radius:999px;text-decoration:none;font-weight:600}
</style>
<div>
  <p><img src="${origin}/favicon.svg" width="32" height="32" alt="Klyv"></p>
  <div class="card">
    <h1>Your Q2 usage report</h1>
    <p>Hi Ada — API calls grew <strong>26%</strong> this quarter. The chart below is attached inline, so it shows without loading anything.</p>
    <p><img src="cid:usage-chart" width="360" height="120" alt="API calls by month, rising each month"></p>
    <p><a class="cta" href="https://klyvui.xyz/billing" onclick="steal()">Open billing</a></p>
  </div>
  <p style="color:#6b6f76;font-size:12px">Sent to ada@example.com. <a href="javascript:alert(1)">Unsubscribe</a></p>
  <img src="${origin}/favicon.svg?open=8f3a" width="1" height="1" alt="">
  <script>document.title = 'pwned'</script>
  <div class="gmail_quote">
    <div class="gmail_attr">On Mon, 30 Jun 2026 at 09:12, Ada Lovelace &lt;ada@example.com&gt; wrote:</div>
    <blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">
      Could the Q2 report include the per-month breakdown this time? Last quarter’s only had the total.
    </blockquote>
  </div>
</div>`
}

function EmailExample() {
  const [origin, setOrigin] = useState('')
  const [shown, setShown] = useState(false)
  useEffect(() => setOrigin(window.location.origin), [])
  return (
    <div className="flex w-full flex-col gap-3">
      <EmailViewer
        subject="Your Q2 usage report"
        from={{ name: 'Klyv Billing', email: 'billing@klyvui.xyz' }}
        to={[{ name: 'Ada Lovelace', email: 'ada@example.com' }]}
        cc={[{ email: 'finance@example.com' }]}
        date={new Date(2026, 6, 1, 8, 30)}
        html={emailHtml(origin)}
        attachments={ATTACHMENTS}
        onShowImages={() => setShown(true)}
      />
      <Note>
        {shown
          ? 'onShowImages fired. The logo, background and the 1×1 tracking pixel are loaded now.'
          : 'The body contains a script, an onclick and a javascript: link. None survive; the frame could not run them anyway.'}
      </Note>
    </div>
  )
}

/* -------------------------------------------------------------- data profile */

function orders() {
  const random = seeded(2026)
  const countries = ['US', 'US', 'US', 'GB', 'DE', 'DE', 'FR', 'IN', 'BR', 'JP']
  const statuses = ['paid', 'paid', 'paid', 'paid', 'refunded', 'pending']
  const start = Date.UTC(2026, 0, 1)
  return Array.from({ length: 240 }, (_, index) => {
    const amount = Math.round((18 + random() * 70 + (random() < 0.2 ? random() * 90 : 0)) * 100) / 100
    const quantity = 1 + Math.floor(random() * 4)
    return {
      order_id: `ord_${(4200 + index).toString(36)}`,
      placed_at: new Date(start + Math.floor(random() * 180) * DAY).toISOString().slice(0, 10),
      amount: index === 17 ? 2840 : index === 131 ? 1995.5 : amount,
      quantity: index % 41 === 0 ? 'n/a' : index % 13 === 0 ? String(quantity) : quantity,
      country: countries[Math.floor(random() * countries.length)],
      status: statuses[Math.floor(random() * statuses.length)],
      gift: random() < 0.12,
      coupon: random() < 0.18 ? ['SUMMER10', 'WELCOME', 'VIP25'][Math.floor(random() * 3)] : null,
      email: index % 29 === 0 ? '' : `customer${Math.floor(random() * 5000)}@example.com`,
    }
  })
}

function ProfileExample() {
  const data = useMemo(orders, [])
  return <DataProfile data={data} className="w-full" />
}

/* ------------------------------------------------------- experiment results */

const SCENARIOS: Record<string, { label: string; metric: string; variants: ExperimentResultsVariant[] }> = {
  winner: {
    label: 'Clear winner',
    metric: 'purchases',
    variants: [
      { id: 'a', name: 'Current checkout', visitors: 41_220, conversions: 1_743, control: true },
      { id: 'b', name: 'One-page checkout', visitors: 41_064, conversions: 2_019 },
    ],
  },
  running: {
    label: 'Keep running',
    metric: 'sign-ups',
    variants: [
      { id: 'a', name: 'Control', visitors: 3_120, conversions: 162, control: true },
      { id: 'b', name: 'Shorter form', visitors: 3_088, conversions: 181 },
      { id: 'c', name: 'Social proof', visitors: 3_141, conversions: 170 },
    ],
  },
  flat: {
    label: 'No effect',
    metric: 'upgrades',
    variants: [
      { id: 'a', name: 'Blue button', visitors: 61_400, conversions: 2_518, control: true },
      { id: 'b', name: 'Green button', visitors: 61_212, conversions: 2_531 },
    ],
  },
}

function ExperimentExample() {
  const [scenario, setScenario] = useState('winner')
  const current = SCENARIOS[scenario]
  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl
        label="Scenario"
        size="sm"
        value={scenario}
        onValueChange={setScenario}
        options={Object.entries(SCENARIOS).map(([value, entry]) => ({ value, label: entry.label }))}
      />
      <ExperimentResults key={scenario} variants={current.variants} metric={current.metric} />
    </div>
  )
}

/* --------------------------------------------------------- access explainer */

const POLICY: AccessExplainerPolicy = {
  users: [
    { id: 'priya', name: 'Priya (engineer)' },
    { id: 'marco', name: 'Marco (platform)' },
    { id: 'sam', name: 'Sam (contractor)' },
    { id: 'lena', name: 'Lena (finance)' },
  ],
  groups: [
    { id: 'engineering', name: 'Engineering', members: ['priya', 'group:platform'] },
    { id: 'platform', name: 'Platform', members: ['marco'] },
    { id: 'contractors', name: 'Contractors', members: ['sam'] },
    { id: 'finance', name: 'Finance', members: ['lena'] },
  ],
  roles: [
    { id: 'viewer', name: 'Viewer', permissions: ['repo:read', 'docs:read'] },
    { id: 'editor', name: 'Editor', permissions: ['repo:read', 'repo:write', 'docs:read', 'docs:write'] },
    { id: 'billing-admin', name: 'Billing admin', permissions: ['billing:*'] },
  ],
  resources: [
    { id: 'acme', name: 'Acme (organisation)' },
    { id: 'eng', name: 'Engineering folder', parent: 'acme' },
    { id: 'api', name: 'api repository', parent: 'eng' },
    { id: 'secrets', name: 'secrets repository', parent: 'eng' },
    { id: 'handbook', name: 'Handbook', parent: 'acme' },
    { id: 'billing', name: 'Billing', parent: 'acme' },
  ],
  bindings: [
    { principal: 'group:engineering', role: 'editor', resource: 'eng' },
    { principal: 'group:contractors', role: 'viewer', resource: 'api' },
    { principal: 'group:finance', role: 'billing-admin', resource: 'billing' },
  ],
  rules: [
    { id: 'handbook-open', effect: 'allow', principal: '*', action: 'docs:read', resource: 'handbook', reason: 'the handbook is for everyone' },
    { id: 'platform-secrets', effect: 'allow', principal: 'group:platform', action: 'repo:read', resource: 'secrets' },
    { id: 'secrets-freeze', effect: 'deny', principal: 'group:engineering', action: 'repo:*', resource: 'secrets', reason: 'frozen during the security review' },
    { id: 'contractor-writes', effect: 'deny', principal: 'group:contractors', action: 'repo:write', resource: 'eng', reason: 'contractors contribute through forks' },
    { id: 'billing-export', effect: 'allow', principal: 'user:priya', action: 'billing:export', resource: 'acme', inherit: false },
  ],
}

function AccessExample() {
  const [query, setQuery] = useState({ user: 'marco', action: 'repo:read', resource: 'secrets' })
  return (
    <div className="flex w-full flex-col gap-3">
      <AccessExplainer policy={POLICY} query={query} onQueryChange={setQuery} />
      <Note>Try Priya writing to the api repository (inherited Editor), Sam doing the same (inherited deny), or Priya exporting billing (a rule that does not inherit).</Note>
    </div>
  )
}

/* ---------------------------------------------------------- passkey manager */

const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/**
 * A stand-in for your server, in the page: it issues a single-use challenge and,
 * on registration, checks the client data the browser signed — type, challenge
 * and origin — before storing the passkey. A real server would also verify the
 * attestation and store the public key.
 */
function useDemoServer() {
  const now = Date.now()
  const [passkeys, setPasskeys] = useState<PasskeyManagerPasskey[]>([
    { id: 'pk-1', name: 'iCloud Keychain', createdAt: new Date(now - 140 * DAY), lastUsedAt: new Date(now - 2 * 3_600_000), deviceType: 'multiDevice', transports: ['internal', 'hybrid'] },
    { id: 'pk-2', name: 'Work YubiKey', createdAt: new Date(now - 400 * DAY), lastUsedAt: new Date(now - 31 * DAY), deviceType: 'singleDevice', transports: ['usb', 'nfc'] },
  ])
  const challenge = useRef<string | null>(null)
  const registered = useRef<ArrayBuffer[]>([])
  const userId = useRef(crypto.getRandomValues(new Uint8Array(16)))

  return {
    passkeys,
    async getCreationOptions(): Promise<PublicKeyCredentialCreationOptions> {
      const bytes = crypto.getRandomValues(new Uint8Array(32))
      challenge.current = toBase64Url(bytes)
      return {
        challenge: bytes,
        rp: { name: 'Klyv demo' },
        user: { id: userId.current, name: 'ada@example.com', displayName: 'Ada Lovelace' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
        excludeCredentials: registered.current.map((id) => ({ type: 'public-key' as const, id })),
        attestation: 'none',
        timeout: 60_000,
      }
    },
    async onCreate({ credential, name, deviceType, transports }: PasskeyManagerCreated) {
      const client = JSON.parse(new TextDecoder().decode(credential.response.clientDataJSON)) as { type: string; challenge: string; origin: string }
      if (client.type !== 'webauthn.create') throw new Error('The server rejected it: wrong ceremony type.')
      if (client.challenge !== challenge.current) throw new Error('The server rejected it: the challenge did not match.')
      if (client.origin !== window.location.origin) throw new Error('The server rejected it: unexpected origin.')
      challenge.current = null
      registered.current.push(credential.rawId)
      setPasskeys((current) => [...current, { id: credential.id, name, createdAt: new Date(), deviceType, transports }])
    },
    async onRename(id: string, name: string) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      setPasskeys((current) => current.map((passkey) => (passkey.id === id ? { ...passkey, name } : passkey)))
    },
    async onRemove(id: string) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      setPasskeys((current) => current.filter((passkey) => passkey.id !== id))
    },
  }
}

function PasskeyExample() {
  const server = useDemoServer()
  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <PasskeyManager
        passkeys={server.passkeys}
        getCreationOptions={server.getCreationOptions}
        onCreate={server.onCreate}
        onRename={server.onRename}
        onRemove={server.onRemove}
      />
      <Note>Creating one runs your browser’s real passkey prompt. The demo server keeps it in memory only — reload and it is gone from this list, though your authenticator still holds it.</Note>
    </div>
  )
}

/* ------------------------------------------------------------------ module */

export const demos: ExampleModule = {
  'hex-viewer': {
    description:
      'Binary data as offset, hex and ASCII, with one selection shared by both panes. Rows are virtualised, so a megabyte scrolls like a hundred bytes; the grid is a single tab stop driven by arrows, Page keys and Home/End, Shift extends, and Ctrl+C copies the selection as hex. Go to any offset in hex or decimal, change the row width, and read the bytes under the cursor as integers.',
    sections: [
      { title: 'A PNG header', description: 'Click or drag in either pane; Shift-click extends. The inspector line reads the bytes at the cursor.', Content: HexExample },
      { title: 'One mebibyte, virtualised', description: '1,048,576 bytes at 32 per row — only about twenty rows exist in the page at a time. Go to 0xffff0.', Content: HexLargeExample },
      rationale(
        'Debugging a file format, a network capture or a corrupted upload means reading bytes, and a <pre> of hex neither selects in step with the text nor survives a large file.',
        'A virtualised grid with synced panes and a keyboard model matches what people expect from desktop hex editors, inside the product.',
        'File inspectors, protocol debuggers, upload diagnostics, firmware and storage tools.',
        ['SegmentedControl', 'Input', 'Button', 'Text'],
      ),
    ],
    props: [
      { name: 'data', type: 'Uint8Array | ArrayBuffer', description: 'The bytes. Only visible rows are rendered.' },
      { name: 'label', type: 'string', description: 'Accessible name for the grid.' },
      { name: 'defaultBytesPerRow', type: '8 | 16 | 32', defaultValue: '16', description: 'Initial row width; the reader can change it.' },
      { name: 'rows', type: 'number', defaultValue: '12', description: 'Visible rows before scrolling.' },
      { name: 'defaultSelection', type: '{ start: number; end: number }', description: 'Initial inclusive selection.' },
      { name: 'onSelectionChange', type: '(selection) => void', description: 'Called as the selection changes.' },
      { name: 'baseOffset', type: 'number', defaultValue: '0', description: 'Added to displayed offsets, for a slice of a larger file.' },
    ],
  },

  'open-api-reference': {
    description:
      'API reference rendered straight from an OpenAPI 3 document. Operations are grouped by tag, each with its method, path, parameters, request body, responses and a curl command generated from the operation. Local $refs resolve as they render — including allOf, shared parameters and shared responses — and a schema that refers to itself is shown once and marked circular.',
    sections: [
      { title: 'A tasks API', description: 'Task.subtasks refers back to Task. Create a task is open; its curl fills the path, the required header and a body built from the schema.', Content: () => <OpenApiReference document={TASKS_API} defaultOpen={['createTask']} className="w-full" /> },
      rationale(
        'Hand-written API docs drift from the spec, and generic renderers either loop forever on recursive schemas or print every $ref as an unreadable path.',
        'Rendering from the document keeps docs and API in step; resolving refs with cycle protection and generating a request from the schema makes it usable, not just accurate.',
        'Developer portals, API settings pages, internal service catalogues.',
        ['CodeBlock', 'Text'],
      ),
    ],
    props: [
      { name: 'document', type: 'OpenApiReferenceDocument', description: 'The parsed OpenAPI 3.x document.' },
      { name: 'baseUrl', type: 'string', description: 'Base for curl. Defaults to the first server.' },
      { name: 'defaultOpen', type: 'string[]', description: 'operationIds (or "METHOD path") open initially.' },
    ],
  },

  'stack-trace': {
    description:
      'An error’s stack parsed into frames — V8 (Chrome, Node), Firefox and Safari, and Python tracebacks. Runs of library frames (node_modules, site-packages, runtime internals) fold into one expandable row so your own frames stand out; opening a frame shows the source around its line through a getSource callback. The raw trace is one click from the clipboard.',
    sections: [
      { title: 'Three formats', Content: TraceExample },
      rationale(
        'A raw trace is mostly framework frames, and the one line that matters is found by reading all of them.',
        'Parsing into frames makes library code collapsible and source context possible, which is most of what an error-tracking product adds over console output.',
        'Error trackers, CI logs, support tooling, admin consoles for background jobs.',
        ['CopyButton', 'Text'],
      ),
    ],
    props: [
      { name: 'trace', type: 'string', description: 'The raw trace text.' },
      { name: 'getSource', type: '(file) => string | undefined | Promise<…>', description: 'Supplies file contents for source context.' },
      { name: 'contextLines', type: 'number', defaultValue: '3', description: 'Lines shown either side.' },
      { name: 'isLibraryFrame', type: '(frame) => boolean', description: 'Overrides which frames fold away.' },
    ],
  },

  'web-vitals': {
    description:
      'This page’s Core Web Vitals, measured live with PerformanceObserver: LCP, CLS by session windows, INP from event timing at the 98th percentile, FCP and TTFB. Each is rated against Google’s thresholds and names the element responsible — the LCP element, the largest shift, the slowest interaction target. Browsers that lack an entry type say so for that metric.',
    sections: [
      { title: 'Measuring this page', description: 'Make a real layout shift or a real slow interaction and watch CLS and INP change.', Content: VitalsExample },
      rationale(
        'Lab scores and field dashboards arrive late and aggregated; while building, you want to see what this change just did to this page.',
        'Measuring with the same definitions as Chrome’s field data, in place, makes regressions visible during development and in staging.',
        'Developer toolbars, staging overlays, performance settings pages, RUM beacons via onReport.',
        ['StatusDot', 'Text'],
      ),
    ],
    props: [
      { name: 'metrics', type: "('LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB')[]", description: 'Which metrics, in order. All five by default.' },
      { name: 'onReport', type: '(metric: WebVitalsMetric) => void', description: 'Called on every update, with value, rating and attribution.' },
    ],
  },

  'a11y-inspector': {
    description:
      'An accessibility audit of one subtree, run against the live DOM with its own checks: images without alt, unnamed controls, buttons and links (names computed from labelledby, aria-label, labels, content and title), skipped heading levels, positive tabindex, duplicate ids, and text contrast computed from the painted colours. Findings are numbered on the page and listed; choosing one focuses the element.',
    sections: [
      { title: 'Auditing a broken form', description: 'The sample has eight problems. Choose one in the list to move focus to it.', Content: InspectorExample },
      rationale(
        'Accessibility problems are found late, by auditors or users, because the tools that find them live in a browser extension nobody opens.',
        'Putting the audit in the product — pointed at the part being built — makes the problems visible while they are still cheap to fix.',
        'Component playgrounds, CMS page previews, design-system docs, internal QA overlays.',
        ['Button', 'Switch', 'Portal', 'Text'],
      ),
    ],
    props: [
      { name: 'target', type: 'RefObject<HTMLElement | null>', description: 'The subtree to audit.' },
      { name: 'rules', type: 'A11yInspectorRule[]', description: 'Which checks to run. All by default.' },
      { name: 'autoRun', type: 'boolean', defaultValue: 'true', description: 'Audit on mount.' },
      { name: 'defaultShowBadges', type: 'boolean', defaultValue: 'true', description: 'Numbered badges over offending elements.' },
      { name: 'onAudit', type: '(issues) => void', description: 'Called with each audit’s findings.' },
    ],
  },

  'email-viewer': {
    description:
      'An email rendered the way an inbox must: the body goes into a sandboxed iframe with no scripts and no same-origin access, after event handlers, script URLs and embeds are stripped. Remote images and CSS backgrounds are blocked by rewriting their URLs until the reader chooses Show images; quoted replies fold away; inline cid: images resolve to attachments; and the frame sizes itself to its content.',
    sections: [
      { title: 'A message with a tracking pixel', description: 'Three remote resources are blocked. The quoted reply is folded below the body.', Content: EmailExample },
      rationale(
        'Rendering somebody else’s HTML inside your app is an XSS hole, and loading its images tells the sender who opened it and when.',
        'A sandboxed frame with blocked remote content is the model every serious mail client uses; the rest is the reading comfort around it.',
        'Support inboxes, CRM timelines, shared mailboxes, email template previews.',
        ['Avatar', 'Button', 'Text'],
      ),
    ],
    props: [
      { name: 'subject / from / to / cc / date', type: 'string / EmailViewerAddress / EmailViewerAddress[] / Date', description: 'The header block.' },
      { name: 'html', type: 'string', description: 'The untrusted body.' },
      { name: 'attachments', type: 'EmailViewerAttachment[]', description: 'Listed below; ones with contentId back cid: images instead.' },
      { name: 'defaultShowImages', type: 'boolean', defaultValue: 'false', description: 'Load remote images from the start.' },
      { name: 'onShowImages', type: '() => void', description: 'Called when the reader allows images — remember the sender.' },
    ],
  },

  'data-profile': {
    description:
      'A per-column profile of an array of records: inferred type (number, date, boolean, category or text), missing share, distinct count, range, mean and median, top values, a small histogram, and flags for what usually breaks an analysis — mixed types, outliers by IQR, mostly-empty columns.',
    sections: [
      { title: '240 orders', description: 'amount has two outliers, quantity mixes numbers with strings and “n/a”, coupon is mostly empty.', Content: ProfileExample },
      rationale(
        'Imported and exported data is trusted before anyone has looked at it, and the problems surface as wrong charts weeks later.',
        'A profile is the first thing a data scientist computes in a notebook; putting it next to the data makes that look automatic.',
        'Import previews, dataset pages, warehouse explorers, CSV upload review.',
        ['Tag', 'Text'],
      ),
    ],
    props: [
      { name: 'data', type: 'Record<string, unknown>[]', description: 'The records.' },
      { name: 'columns', type: 'string[]', description: 'Order and subset. Defaults to every key seen.' },
      { name: 'maxCategories', type: 'number', defaultValue: '12', description: 'Text with at most this many distinct values is a category.' },
      { name: 'bins', type: 'number', defaultValue: '12', description: 'Histogram bins for numbers and dates.' },
    ],
  },

  'experiment-results': {
    description:
      'An A/B/n readout that does the statistics and says what they mean: Wilson intervals on each rate, relative lift with its interval, a two-proportion z-test against control, Bonferroni correction when there are several challengers, the sample each variant needs for the minimum lift you care about, and a one-sentence recommendation.',
    sections: [
      { title: 'Three outcomes', description: 'Change the confidence level or the minimum lift and watch the verdict and the required sample move.', Content: ExperimentExample },
      rationale(
        'Test dashboards show a percentage and a green arrow, so tests are stopped early on noise or left running long after they had an answer.',
        'Separating “not significant yet” from “no effect of that size” — with the sample size that decides between them — is the judgement people actually need.',
        'Experimentation platforms, feature-flag rollouts, growth and pricing dashboards.',
        ['SegmentedControl', 'Input', 'Text'],
      ),
    ],
    props: [
      { name: 'variants', type: 'ExperimentResultsVariant[]', description: 'id, name, visitors, conversions; control marks the baseline (else the first).' },
      { name: 'metric', type: 'string', defaultValue: "'conversions'", description: 'What a conversion is.' },
      { name: 'alpha / defaultAlpha / onAlphaChange', type: '0.1 | 0.05 | 0.01', defaultValue: '0.05', description: 'Significance level, controlled or not.' },
      { name: 'defaultMinimumEffect', type: 'number', defaultValue: '0.1', description: 'Relative lift for the sample-size calculation.' },
      { name: 'power', type: 'number', defaultValue: '0.8', description: 'Statistical power.' },
    ],
  },

  'access-explainer': {
    description:
      'Answers “can this user do this, here?” with the evaluation itself. Given users, nested groups, roles with wildcard permissions, a resource tree, role bindings and explicit allow and deny rules, it evaluates the query and lists each step: group membership and how, inherited scopes, every binding and rule checked, which deny overrode which allow, and the decision.',
    sections: [
      { title: 'Why Marco cannot read secrets', description: 'Marco’s Platform group is allowed, but Platform sits inside Engineering, and Engineering is denied.', Content: AccessExample },
      rationale(
        'Access questions become support tickets because the answer depends on inheritance and deny rules nobody can see at once.',
        'A trace shows the one inherited rule responsible, which is what an admin needs to fix it — or to explain why it is right.',
        'Admin consoles, sharing dialogs (“why can’t they see this?”), IAM and policy editors, audits.',
        ['Field', 'Select', 'Text'],
      ),
    ],
    props: [
      { name: 'policy', type: 'AccessExplainerPolicy', description: 'users, groups, roles, resources, bindings, rules.' },
      { name: 'query / defaultQuery / onQueryChange', type: '{ user; action; resource }', description: 'The question, controlled or not.' },
      { name: 'actions', type: 'string[]', description: 'Actions offered. Defaults to every non-wildcard action in the policy.' },
    ],
  },

  'passkey-manager': {
    description:
      'Passkeys for an account. It checks for WebAuthn, a secure context and a built-in authenticator before offering anything, then runs the real registration ceremony with options your server issues and hands the credential back for verification. Registered passkeys show whether they sync, when they were last used, and can be renamed inline or removed after a confirmation.',
    sections: [
      { title: 'With an in-page demo server', description: 'The server issues a single-use challenge and checks the signed client data before storing the passkey.', Content: PasskeyExample },
      rationale(
        'Passwordless sign-in fails on the details: offering passkeys where they cannot work, cryptic cancel errors, and lists nobody can tell apart.',
        'Support checks up front, translated errors and synced-or-not labels are what make the ceremony trustworthy to people who have never heard the word WebAuthn.',
        'Account security settings, onboarding after sign-up, admin views of a user’s credentials.',
        ['Button', 'ConfirmPopover', 'Input', 'Tag', 'Text'],
      ),
    ],
    props: [
      { name: 'passkeys', type: 'PasskeyManagerPasskey[]', description: 'What the server has on record.' },
      { name: 'getCreationOptions', type: '() => Promise<PublicKeyCredentialCreationOptions>', description: 'Fresh options and challenge per attempt.' },
      { name: 'onCreate', type: '(created: PasskeyManagerCreated) => void | Promise<void>', description: 'Verify and store. A rejection shows its message.' },
      { name: 'onRename', type: '(id, name) => void | Promise<void>', description: 'Rename a passkey.' },
      { name: 'onRemove', type: '(id) => void | Promise<void>', description: 'Remove after confirmation.' },
      { name: 'now', type: 'Date', description: 'The current moment, for previews and tests.' },
    ],
  },
}
