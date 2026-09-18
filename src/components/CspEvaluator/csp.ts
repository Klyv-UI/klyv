/**
 * Content-Security-Policy parsing and review for CspEvaluator.
 *
 * Parsing follows CSP3: directives split on `;`, names are case-insensitive,
 * the first occurrence of a directive wins, and a `,` starts another policy.
 * The review knows the interactions that decide whether a policy protects
 * anything: a nonce or hash makes 'unsafe-inline' ignored, 'strict-dynamic'
 * makes host and scheme sources ignored, and most fetch directives fall back
 * to default-src when missing — while base-uri, form-action and
 * frame-ancestors fall back to nothing at all.
 */

export type CspEvaluatorSeverity = 'high' | 'medium' | 'low' | 'info'

export interface CspEvaluatorFinding {
  severity: CspEvaluatorSeverity
  directive: string
  message: string
}

export interface CspEvaluatorSource {
  text: string
  kind: 'keyword' | 'nonce' | 'hash' | 'scheme' | 'host' | 'wildcard' | 'unknown'
  /** Why the browser ignores this source here, if it does. */
  ignored?: string
}

export interface CspEvaluatorDirective {
  name: string
  sources: CspEvaluatorSource[]
  /** Raw value, for directives that are not source lists (report-to, sandbox). */
  value: string
}

export interface CspEvaluatorEffective {
  /** The resource type, e.g. `script-src-elem`. */
  type: string
  /** What it governs, in words. */
  label: string
  /** The directive that supplies the list, or null when nothing restricts it. */
  from: string | null
  sources: CspEvaluatorSource[]
}

export interface CspEvaluatorReport {
  directives: CspEvaluatorDirective[]
  findings: CspEvaluatorFinding[]
  effective: CspEvaluatorEffective[]
  /** Further policies after a comma, not evaluated. */
  extraPolicies: number
}

const KEYWORDS = new Set([
  "'self'", "'none'", "'unsafe-inline'", "'unsafe-eval'", "'strict-dynamic'", "'unsafe-hashes'", "'wasm-unsafe-eval'",
  "'report-sample'", "'unsafe-allow-redirects'", "'inline-speculation-rules'",
])

const FETCH = [
  'default-src', 'script-src', 'script-src-elem', 'script-src-attr', 'style-src', 'style-src-elem', 'style-src-attr', 'img-src', 'font-src',
  'connect-src', 'media-src', 'object-src', 'frame-src', 'child-src', 'worker-src', 'manifest-src', 'prefetch-src', 'fenced-frame-src',
]
const OTHER = ['base-uri', 'form-action', 'frame-ancestors', 'sandbox', 'report-uri', 'report-to', 'upgrade-insecure-requests', 'block-all-mixed-content', 'require-trusted-types-for', 'trusted-types', 'webrtc', 'navigate-to', 'plugin-types', 'referrer']

/** Resource types and the chain each one walks when its own directive is missing. */
const FALLBACK: [string, string, string[]][] = [
  ['script-src-elem', 'Script elements', ['script-src-elem', 'script-src', 'default-src']],
  ['script-src-attr', 'Inline event handlers', ['script-src-attr', 'script-src', 'default-src']],
  ['style-src-elem', 'Stylesheets and style elements', ['style-src-elem', 'style-src', 'default-src']],
  ['style-src-attr', 'Inline style attributes', ['style-src-attr', 'style-src', 'default-src']],
  ['img-src', 'Images', ['img-src', 'default-src']],
  ['font-src', 'Fonts', ['font-src', 'default-src']],
  ['connect-src', 'fetch, XHR, WebSocket', ['connect-src', 'default-src']],
  ['media-src', 'Audio and video', ['media-src', 'default-src']],
  ['object-src', 'Plugins (object, embed)', ['object-src', 'default-src']],
  ['frame-src', 'Frames', ['frame-src', 'child-src', 'default-src']],
  ['worker-src', 'Workers', ['worker-src', 'child-src', 'script-src', 'default-src']],
  ['manifest-src', 'Web app manifests', ['manifest-src', 'default-src']],
  ['base-uri', 'The <base> element', ['base-uri']],
  ['form-action', 'Form submissions', ['form-action']],
  ['frame-ancestors', 'Who may frame this page', ['frame-ancestors']],
]

function classify(text: string): CspEvaluatorSource['kind'] {
  const lower = text.toLowerCase()
  if (KEYWORDS.has(lower)) return 'keyword'
  if (/^'nonce-[A-Za-z0-9+/_=-]+'$/.test(text)) return 'nonce'
  if (/^'sha(256|384|512)-[A-Za-z0-9+/_=-]+'$/.test(text)) return 'hash'
  if (text === '*') return 'wildcard'
  if (/^[a-z][a-z0-9+.-]*:$/i.test(text)) return 'scheme'
  if (/^([a-z][a-z0-9+.-]*:\/\/)?(\*\.)?[a-z0-9.-]+(:(\d+|\*))?(\/\S*)?$/i.test(text) || /^([a-z][a-z0-9+.-]*:\/\/)?\*(:\d+)?$/i.test(text)) return 'host'
  return 'unknown'
}

export function parseCsp(header: string): { directives: CspEvaluatorDirective[]; findings: CspEvaluatorFinding[]; extraPolicies: number } {
  const findings: CspEvaluatorFinding[] = []
  const [first, ...rest] = header.replace(/^\s*content-security-policy\s*:\s*/i, '').split(',')
  const directives: CspEvaluatorDirective[] = []
  for (const raw of first.split(';')) {
    const tokens = raw.trim().split(/\s+/).filter(Boolean)
    if (!tokens.length) continue
    const name = tokens[0].toLowerCase()
    if (directives.some((d) => d.name === name)) {
      findings.push({ severity: 'medium', directive: name, message: `${name} appears twice; browsers use the first and ignore the second` })
      continue
    }
    if (!FETCH.includes(name) && !OTHER.includes(name)) {
      findings.push({ severity: 'low', directive: name, message: `${name} is not a directive browsers know; it is ignored (a typo?)` })
    }
    const sources = FETCH.includes(name) || name === 'base-uri' || name === 'form-action' || name === 'frame-ancestors'
      ? tokens.slice(1).map((text) => ({ text, kind: classify(text) }))
      : []
    for (const source of sources) {
      const bare = source.text.toLowerCase()
      if (source.kind === 'host' && ['self', 'none', 'unsafe-inline', 'unsafe-eval', 'strict-dynamic'].includes(bare)) {
        findings.push({ severity: 'high', directive: name, message: `${source.text} without quotes is read as a host named “${source.text}”; write '${bare}'` })
      } else if (source.kind === 'unknown') {
        findings.push({ severity: 'low', directive: name, message: `${source.text} is not a valid source expression and is ignored` })
      }
    }
    directives.push({ name, sources, value: tokens.slice(1).join(' ') })
  }
  return { directives, findings, extraPolicies: rest.filter((p) => p.trim()).length }
}

const has = (list: CspEvaluatorSource[], text: string) => list.some((s) => s.text.toLowerCase() === text)

/** Mark what the browser ignores in a script list: 'unsafe-inline' next to a nonce or hash, hosts next to 'strict-dynamic'. */
function annotate(type: string, list: CspEvaluatorSource[]): CspEvaluatorSource[] {
  const scriptish = type.startsWith('script-src') || type === 'worker-src'
  const styleish = type.startsWith('style-src')
  const nonceOrHash = list.some((s) => s.kind === 'nonce' || s.kind === 'hash')
  const dynamic = scriptish && has(list, "'strict-dynamic'")
  const none = has(list, "'none'") && list.length > 1
  return list.map((source) => {
    const lower = source.text.toLowerCase()
    if (none && lower === "'none'") return { ...source, ignored: "'none' is ignored when other sources are listed" }
    if ((scriptish || styleish) && lower === "'unsafe-inline'" && nonceOrHash) return { ...source, ignored: 'ignored because a nonce or hash is present' }
    if (dynamic && (source.kind === 'host' || source.kind === 'scheme' || source.kind === 'wildcard' || lower === "'self'" || lower === "'unsafe-inline'")) {
      return { ...source, ignored: "ignored because of 'strict-dynamic'" }
    }
    return source
  })
}

export function evaluateCsp(header: string): CspEvaluatorReport {
  const { directives, findings, extraPolicies } = parseCsp(header)
  const get = (name: string) => directives.find((d) => d.name === name)
  const effective: CspEvaluatorEffective[] = FALLBACK.map(([type, label, chain]) => {
    const from = chain.find((name) => get(name)) ?? null
    return { type, label, from, sources: from ? annotate(type, get(from)!.sources) : [] }
  })
  const eff = (type: string) => effective.find((e) => e.type === type)!
  const push = (severity: CspEvaluatorSeverity, directive: string, message: string) => findings.push({ severity, directive, message })

  if (directives.length === 0) {
    push('high', 'policy', 'The policy is empty: it restricts nothing')
    return { directives, findings, effective, extraPolicies }
  }
  if (extraPolicies) push('info', 'policy', `${extraPolicies} more polic${extraPolicies === 1 ? 'y' : 'ies'} after a comma; each is enforced too, but only the first is reviewed here`)
  if (!get('default-src')) push('medium', 'default-src', 'No default-src: any resource type without its own directive is unrestricted')

  // Scripts: the part that decides whether XSS is stopped.
  const script = eff('script-src-elem')
  if (!script.from) push('high', 'script-src', 'Neither script-src nor default-src is set, so any script from anywhere can run')
  else {
    const list = script.sources
    const live = list.filter((s) => !s.ignored)
    const d = script.from
    const nonceOrHash = list.some((s) => s.kind === 'nonce' || s.kind === 'hash')
    const dynamic = has(list, "'strict-dynamic'")
    if (has(list, "'unsafe-inline'")) {
      if (nonceOrHash) push('info', d, "'unsafe-inline' is ignored by CSP2+ browsers because a nonce or hash is present; it stays only as a fallback for very old ones")
      else push('high', d, "'unsafe-inline' lets any injected <script> or event handler run — the policy does not stop XSS")
    }
    if (has(list, "'unsafe-eval'")) push('medium', d, "'unsafe-eval' allows eval() and new Function(), so injected strings can become code")
    if (live.some((s) => s.kind === 'wildcard')) push('high', d, '* allows scripts from any host')
    for (const s of live) {
      const lower = s.text.toLowerCase()
      if (lower === 'data:') push('high', d, 'data: in scripts lets an attacker supply the script inline as a URL')
      else if (lower === 'https:' || lower === 'http:') push('high', d, `${s.text} allows scripts from any host on that scheme`)
      else if (s.kind === 'host' && (lower.startsWith('http://') || lower === '*.' || /^\*\.[^.]+$/.test(lower))) {
        push('medium', d, lower.startsWith('http://') ? `${s.text} is loaded over plain http and can be tampered with in transit` : `${s.text} trusts every subdomain of a top-level domain`)
      }
    }
    if (dynamic && !nonceOrHash) push('high', d, "'strict-dynamic' without a nonce or hash trusts nothing to start from: no script can load")
    if (!nonceOrHash && !dynamic && live.some((s) => s.kind === 'host' || s.text.toLowerCase() === "'self'")) {
      push('low', d, "An allowlist of hosts is often bypassable (JSONP endpoints, script gadgets on a CDN); nonces with 'strict-dynamic' are sturdier")
    }
    for (const s of list) {
      if (s.kind === 'nonce' && s.text.length - 8 < 22) push('medium', d, `${s.text} is short; a nonce needs at least 128 bits of randomness (22+ base64 characters) and must change on every response`)
    }
  }

  const object = eff('object-src')
  if (!object.from) push('high', 'object-src', "No object-src or default-src: plugins can load from anywhere. Add object-src 'none'")
  else if (!has(object.sources, "'none'") || object.sources.length > 1) {
    push(object.from === 'default-src' ? 'medium' : 'high', 'object-src', `Plugins fall under ${object.from}, which allows more than 'none'. Add object-src 'none'`)
  }
  if (!get('base-uri')) push('medium', 'base-uri', "No base-uri: an injected <base> tag can redirect every relative script URL, nonces included. Add base-uri 'none' or 'self'")
  if (!get('frame-ancestors')) push('low', 'frame-ancestors', "No frame-ancestors: other sites can frame this page (clickjacking). It does not fall back to default-src, and does not work in a <meta> tag")
  if (!get('form-action')) push('low', 'form-action', 'No form-action: an injected form can post anywhere. It does not fall back to default-src')

  const style = eff('style-src-elem')
  if (style.from && style.sources.some((s) => s.text.toLowerCase() === "'unsafe-inline'" && !s.ignored)) {
    push('low', style.from, "'unsafe-inline' in styles allows CSS injection, which can leak data through attribute selectors")
  }
  for (const e of effective) {
    if (e.type.startsWith('script') || e.type.startsWith('style')) continue
    const live = e.sources.filter((s) => !s.ignored)
    if (live.some((s) => s.kind === 'wildcard') && e.from && e.from !== 'default-src') push('low', e.from, `* in ${e.from} allows ${e.label.toLowerCase()} from any host`)
    if (live.some((s) => s.text.toLowerCase().startsWith('http:') || s.text.toLowerCase().startsWith('http://')) && e.from && e.from !== 'default-src') {
      push('low', e.from, `${e.from} allows plain http sources`)
    }
  }
  if (get('default-src')?.sources.some((s) => s.kind === 'wildcard')) push('medium', 'default-src', 'default-src * allows everything not otherwise restricted')

  if (get('report-uri') && !get('report-to')) push('info', 'report-uri', 'report-uri is deprecated; add report-to (with a Reporting-Endpoints header) alongside it')
  else if (!get('report-uri') && !get('report-to')) push('low', 'report-to', 'No reporting: violations happen silently. Add report-to to hear about them')
  if (get('upgrade-insecure-requests')) push('info', 'upgrade-insecure-requests', 'http: subresource URLs are upgraded to https: before loading')

  const order: CspEvaluatorSeverity[] = ['high', 'medium', 'low', 'info']
  findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))
  return { directives, findings, effective, extraPolicies }
}
