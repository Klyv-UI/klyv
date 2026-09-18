/**
 * curl command → request model → code, for CurlConverter.
 *
 * The tokenizer reads a command the way a POSIX shell would split it: single
 * quotes are literal, double quotes allow \ before $ ` " \ and newline,
 * backslash escapes outside quotes, $'…' ANSI-C strings, and a backslash at
 * the end of a line continues it. Variables are not expanded — that would
 * need the reader’s environment — and are reported instead. Each flag then
 * applies curl’s own semantics to one request model, which the generators
 * turn into fetch, axios or Python requests code.
 */

export interface CurlConverterNote {
  level: 'info' | 'warn'
  message: string
}

export interface CurlConverterPart {
  name: string
  value: string
  /** Set when the value is a file curl would read (`-F name=@path`). */
  file?: string
  contentType?: string
}

export interface CurlConverterRequest {
  method: string
  url: string
  /** In order, as given. Names keep their case. */
  headers: [string, string][]
  body:
    | { kind: 'none' }
    | { kind: 'raw'; text: string }
    | { kind: 'json'; text: string; value?: unknown }
    | { kind: 'form'; fields: [string, string][]; text: string }
    | { kind: 'multipart'; parts: CurlConverterPart[] }
  auth?: { user: string; password: string }
  cookies?: string
  insecure: boolean
  followRedirects: boolean
  compressed: boolean
  /** Seconds, from --max-time. */
  timeout?: number
  notes: CurlConverterNote[]
}

export function tokenizeShell(input: string): { tokens: string[]; notes: CurlConverterNote[] } | { error: string } {
  const tokens: string[] = []
  const notes: CurlConverterNote[] = []
  let current = ''
  let started = false
  let i = 0
  const push = () => {
    if (started) tokens.push(current)
    current = ''
    started = false
  }
  while (i < input.length) {
    const c = input[i]
    if (c === '\\') {
      const next = input[i + 1]
      if (next === '\n') i += 2
      else if (next === '\r' && input[i + 2] === '\n') i += 3
      else if (next === undefined) i++
      else {
        current += next
        started = true
        i += 2
      }
      continue
    }
    if (c === "'") {
      const end = input.indexOf("'", i + 1)
      if (end === -1) return { error: 'A single quote is never closed' }
      current += input.slice(i + 1, end)
      started = true
      i = end + 1
      continue
    }
    if (c === '$' && input[i + 1] === "'") {
      let j = i + 2
      let out = ''
      const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', a: '\x07', e: '\x1b', '0': '\0' }
      while (j < input.length && input[j] !== "'") {
        if (input[j] === '\\') {
          const e = input[j + 1]
          if (e === 'x' && /^[\da-f]{1,2}/i.test(input.slice(j + 2))) {
            const hex = /^[\da-f]{1,2}/i.exec(input.slice(j + 2))![0]
            out += String.fromCharCode(parseInt(hex, 16))
            j += 2 + hex.length
            continue
          }
          out += map[e] ?? e
          j += 2
        } else out += input[j++]
      }
      if (j >= input.length) return { error: "A $' string is never closed" }
      current += out
      started = true
      i = j + 1
      continue
    }
    if (c === '"') {
      let j = i + 1
      while (j < input.length && input[j] !== '"') {
        if (input[j] === '\\' && '$`"\\\n'.includes(input[j + 1] ?? '')) {
          if (input[j + 1] !== '\n') current += input[j + 1]
          j += 2
          continue
        }
        if (input[j] === '$' && /[A-Za-z_{]/.test(input[j + 1] ?? '')) {
          const name = /^\$\{?(\w+)\}?/.exec(input.slice(j))![0]
          notes.push({ level: 'warn', message: `${name} is a shell variable and was not expanded` })
        }
        current += input[j++]
      }
      if (j >= input.length) return { error: 'A double quote is never closed' }
      started = true
      i = j + 1
      continue
    }
    if (c === '#' && !started) {
      while (i < input.length && input[i] !== '\n') i++
      continue
    }
    if (/\s/.test(c)) {
      push()
      i++
      continue
    }
    if (c === '|' || c === ';' || (c === '&' && input[i + 1] === '&')) {
      push()
      notes.push({ level: 'warn', message: `Everything after “${c === '&' ? '&&' : c}” is another command and was ignored` })
      break
    }
    if (c === '$' && /[A-Za-z_{]/.test(input[i + 1] ?? '')) {
      const name = /^\$\{?(\w+)\}?/.exec(input.slice(i))![0]
      notes.push({ level: 'warn', message: `${name} is a shell variable and was not expanded` })
    }
    current += c
    started = true
    i++
  }
  push()
  return { tokens, notes }
}

/** Flags that take a value, long and short. */
const WITH_VALUE = new Set([
  '-X', '--request', '-H', '--header', '-d', '--data', '--data-ascii', '--data-raw', '--data-binary', '--data-urlencode', '--json',
  '-F', '--form', '--form-string', '-u', '--user', '-b', '--cookie', '--url', '-A', '--user-agent', '-e', '--referer',
  '-m', '--max-time', '--connect-timeout', '-o', '--output', '-x', '--proxy', '--oauth2-bearer', '-w', '--write-out', '-c', '--cookie-jar',
  '--retry', '-T', '--upload-file', '-E', '--cert', '--cacert', '--key', '-r', '--range',
])
const SHORT_WITH_VALUE = new Set([...WITH_VALUE].filter((f) => /^-\w$/.test(f)).map((f) => f[1]))
const IGNORED: Record<string, string> = {
  '-s': 'progress output', '--silent': 'progress output', '-S': 'error output', '--show-error': 'error output', '-v': 'verbose logging',
  '--verbose': 'verbose logging', '-i': 'printing response headers', '--include': 'printing response headers', '-f': 'failing on HTTP errors',
  '--fail': 'failing on HTTP errors', '-o': 'where the body is saved', '--output': 'where the body is saved', '-w': 'the output format',
  '--write-out': 'the output format', '-#': 'the progress bar', '--progress-bar': 'the progress bar', '-c': 'the cookie jar file',
  '--cookie-jar': 'the cookie jar file', '--retry': 'retries', '--connect-timeout': 'the connect timeout',
}
const UNSUPPORTED: Record<string, string> = {
  '-x': 'a proxy', '--proxy': 'a proxy', '-T': 'uploading a file', '--upload-file': 'uploading a file', '-E': 'a client certificate',
  '--cert': 'a client certificate', '--cacert': 'a custom CA bundle', '--key': 'a client key', '-r': 'a byte range (add a Range header instead)',
  '--range': 'a byte range (add a Range header instead)',
}

const encode = (text: string) => encodeURIComponent(text).replace(/%20/g, '+')

export function parseCurl(input: string): { ok: true; request: CurlConverterRequest } | { ok: false; error: string } {
  const split = tokenizeShell(input.trim().replace(/^\$\s+/, ''))
  if ('error' in split) return { ok: false, error: split.error }
  const { tokens, notes } = split
  if (tokens[0] !== 'curl') return { ok: false, error: 'The command must start with curl' }

  const request: CurlConverterRequest = { method: '', url: '', headers: [], body: { kind: 'none' }, insecure: false, followRedirects: false, compressed: false, notes }
  const data: string[] = []
  const parts: CurlConverterPart[] = []
  let json = false
  let get = false
  let head = false
  const urls: string[] = []

  // Expand -sSL into -s -S -L and -XPOST into -X POST; split --flag=value.
  const args: string[] = []
  for (const token of tokens.slice(1)) {
    if (/^--[\w-]+=/.test(token)) {
      const at = token.indexOf('=')
      args.push(token.slice(0, at), token.slice(at + 1))
    } else if (/^-[A-Za-z#]{2,}/.test(token) && !token.startsWith('--')) {
      for (let k = 1; k < token.length; k++) {
        const flag = token[k]
        args.push(`-${flag}`)
        if (SHORT_WITH_VALUE.has(flag)) {
          if (k + 1 < token.length) args.push(token.slice(k + 1))
          break
        }
      }
    } else args.push(token)
  }

  for (let i = 0; i < args.length; i++) {
    const flag = args[i]
    if (!flag.startsWith('-') || flag === '-') {
      urls.push(flag)
      continue
    }
    const takes = WITH_VALUE.has(flag)
    const value = takes ? args[++i] : undefined
    if (takes && value === undefined) return { ok: false, error: `${flag} needs a value` }
    const v = value ?? ''
    switch (flag) {
      case '-X':
      case '--request':
        request.method = v.toUpperCase()
        break
      case '-H':
      case '--header': {
        const colon = v.indexOf(':')
        if (colon === -1) notes.push({ level: 'warn', message: `Header “${v}” has no colon and was skipped` })
        else if (v.slice(colon + 1).trim() === '' && v.endsWith(';') === false) notes.push({ level: 'info', message: `“${v}” removes a default header in curl; nothing to do here` })
        else request.headers.push([v.slice(0, colon).trim(), v.slice(colon + 1).trim().replace(/;$/, '')])
        break
      }
      case '-d':
      case '--data':
      case '--data-ascii':
      case '--data-binary':
      case '--data-raw':
      case '--json':
        if (v.startsWith('@') && flag !== '--data-raw') {
          notes.push({ level: 'warn', message: `${flag} ${v} reads the body from a file; paste the file’s contents instead` })
        }
        // curl strips newlines from -d/--data, not from --data-binary or --data-raw.
        data.push(flag === '-d' || flag === '--data' || flag === '--data-ascii' ? v.replace(/[\r\n]/g, '') : v)
        if (flag === '--json') json = true
        break
      case '--data-urlencode': {
        const eq = v.indexOf('=')
        data.push(eq === -1 ? encode(v) : eq === 0 ? encode(v.slice(1)) : `${v.slice(0, eq)}=${encode(v.slice(eq + 1))}`)
        break
      }
      case '-F':
      case '--form':
      case '--form-string': {
        const eq = v.indexOf('=')
        if (eq === -1) {
          notes.push({ level: 'warn', message: `Form field “${v}” has no = and was skipped` })
          break
        }
        const name = v.slice(0, eq)
        let rest = v.slice(eq + 1)
        let contentType: string | undefined
        const typed = /;type=([^;]+)/.exec(rest)
        if (typed && flag !== '--form-string') {
          contentType = typed[1]
          rest = rest.replace(typed[0], '')
        }
        if (flag !== '--form-string' && rest.startsWith('@')) {
          parts.push({ name, value: '', file: rest.slice(1).split(';')[0], contentType })
          notes.push({ level: 'info', message: `-F ${name}=@… attaches a file; the code expects you to supply it` })
        } else if (flag !== '--form-string' && rest.startsWith('<')) {
          parts.push({ name, value: '', file: rest.slice(1), contentType })
          notes.push({ level: 'info', message: `-F ${name}=<… reads a field’s text from a file; the code expects you to supply it` })
        } else parts.push({ name, value: rest, contentType })
        break
      }
      case '-u':
      case '--user': {
        const colon = v.indexOf(':')
        request.auth = colon === -1 ? { user: v, password: '' } : { user: v.slice(0, colon), password: v.slice(colon + 1) }
        if (colon === -1) notes.push({ level: 'info', message: 'curl would prompt for the password; it is left empty' })
        break
      }
      case '--oauth2-bearer':
        request.headers.push(['Authorization', `Bearer ${v}`])
        break
      case '-b':
      case '--cookie':
        if (v.includes('=')) request.cookies = v
        else notes.push({ level: 'warn', message: `-b ${v} reads cookies from a file, which the generated code cannot do` })
        break
      case '--url':
        urls.push(v)
        break
      case '-A':
      case '--user-agent':
        request.headers.push(['User-Agent', v])
        break
      case '-e':
      case '--referer':
        request.headers.push(['Referer', v])
        break
      case '-m':
      case '--max-time':
        request.timeout = Number(v)
        break
      case '-G':
      case '--get':
        get = true
        break
      case '-I':
      case '--head':
        head = true
        break
      case '-k':
      case '--insecure':
        request.insecure = true
        notes.push({ level: 'warn', message: '-k turns off certificate checks. fetch and axios in a browser cannot; Python gets verify=False' })
        break
      case '-L':
      case '--location':
        request.followRedirects = true
        break
      case '--compressed':
        request.compressed = true
        notes.push({ level: 'info', message: '--compressed: all three clients accept and decode gzip by default' })
        break
      default:
        if (IGNORED[flag]) notes.push({ level: 'info', message: `${flag} controls ${IGNORED[flag]} in the terminal; ignored` })
        else if (UNSUPPORTED[flag]) notes.push({ level: 'warn', message: `${flag} sets ${UNSUPPORTED[flag]}, which is not converted` })
        else notes.push({ level: 'warn', message: `${flag} is not supported and was ignored` })
    }
  }

  if (urls.length === 0) return { ok: false, error: 'No URL found' }
  if (urls.length > 1) notes.push({ level: 'warn', message: `${urls.length} URLs given; only the first is converted` })
  let url = urls[0]
  if (!/^[a-z][\w+.-]*:\/\//i.test(url)) {
    url = `http://${url}`
    notes.push({ level: 'info', message: 'No scheme in the URL; curl assumes http://' })
  }

  const hasHeader = (name: string) => request.headers.some(([n]) => n.toLowerCase() === name.toLowerCase())
  if (get && data.length) {
    url += (url.includes('?') ? '&' : '?') + data.join('&')
  } else if (parts.length) {
    if (data.length) return { ok: false, error: 'curl cannot combine -d and -F in one request' }
    request.body = { kind: 'multipart', parts }
  } else if (data.length) {
    const text = data.join('&')
    const type = request.headers.find(([n]) => n.toLowerCase() === 'content-type')?.[1] ?? ''
    if (json || /json/i.test(type)) {
      let value: unknown
      try {
        value = JSON.parse(text)
      } catch {
        notes.push({ level: 'warn', message: 'The body is sent as JSON but does not parse as JSON' })
      }
      request.body = { kind: 'json', text, value }
      if (json && !hasHeader('Content-Type')) request.headers.push(['Content-Type', 'application/json'])
      if (json && !hasHeader('Accept')) request.headers.push(['Accept', 'application/json'])
    } else if (!type || /x-www-form-urlencoded/i.test(type)) {
      const fields = text.split('&').filter(Boolean).map((pair): [string, string] => {
        const eq = pair.indexOf('=')
        const decode = (s: string) => {
          try {
            return decodeURIComponent(s.replace(/\+/g, ' '))
          } catch {
            return s
          }
        }
        return eq === -1 ? [decode(pair), ''] : [decode(pair.slice(0, eq)), decode(pair.slice(eq + 1))]
      })
      request.body = { kind: 'form', fields, text }
      if (!hasHeader('Content-Type')) request.headers.push(['Content-Type', 'application/x-www-form-urlencoded'])
    } else request.body = { kind: 'raw', text }
  }
  request.method = request.method || (head ? 'HEAD' : request.body.kind !== 'none' ? 'POST' : 'GET')
  request.url = url
  return { ok: true, request }
}

/* ------------------------------------------------------------ generators */

const js = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`
const py = js
const jsKey = (key: string) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : js(key))

function jsValue(value: unknown, indent: string): string {
  if (Array.isArray(value)) return value.length ? `[\n${value.map((v) => `${indent}  ${jsValue(v, `${indent}  `)}`).join(',\n')},\n${indent}]` : '[]'
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    return entries.length ? `{\n${entries.map(([k, v]) => `${indent}  ${jsKey(k)}: ${jsValue(v, `${indent}  `)}`).join(',\n')},\n${indent}}` : '{}'
  }
  return typeof value === 'string' ? js(value) : String(value)
}

function pyValue(value: unknown, indent: string): string {
  if (Array.isArray(value)) return value.length ? `[\n${value.map((v) => `${indent}    ${pyValue(v, `${indent}    `)}`).join(',\n')},\n${indent}]` : '[]'
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    return entries.length ? `{\n${entries.map(([k, v]) => `${indent}    ${py(k)}: ${pyValue(v, `${indent}    `)}`).join(',\n')},\n${indent}}` : '{}'
  }
  if (value === null) return 'None'
  if (value === true) return 'True'
  if (value === false) return 'False'
  return typeof value === 'string' ? py(value) : String(value)
}

function headersFor(request: CurlConverterRequest, forBrowser: boolean): [string, string][] {
  const headers = [...request.headers]
  if (forBrowser && request.auth) headers.push(['Authorization', `Basic \${btoa(${js(`${request.auth.user}:${request.auth.password}`)})}`])
  if (request.cookies) headers.push(['Cookie', request.cookies])
  // FormData sets its own multipart boundary; a copied Content-Type would break it.
  return request.body.kind === 'multipart' ? headers.filter(([n]) => n.toLowerCase() !== 'content-type') : headers
}

const jsHeaderLine = ([name, value]: [string, string]) =>
  `    ${jsKey(name)}: ${value.startsWith('Basic ${btoa(') ? `\`${value}\`` : js(value)}`

/** Form fields as an object, or as pairs when a name repeats. */
const formValue = (fields: [string, string][]) =>
  new Set(fields.map(([k]) => k)).size === fields.length
    ? jsValue(Object.fromEntries(fields), '  ')
    : `[${fields.map(([k, v]) => `\n    [${js(k)}, ${js(v)}],`).join('')}\n  ]`

function formDataLines(parts: CurlConverterPart[]) {
  return [
    'const form = new FormData()',
    ...parts.map((part) =>
      part.file ? `form.append(${js(part.name)}, file) // ${part.file}${part.contentType ? `, ${part.contentType}` : ''}` : `form.append(${js(part.name)}, ${js(part.value)})`,
    ),
    '',
  ]
}

export function toFetch(request: CurlConverterRequest): string {
  const lines: string[] = []
  const headers = headersFor(request, true)
  const { body } = request
  if (body.kind === 'multipart') lines.push(...formDataLines(body.parts))
  lines.push(`const response = await fetch(${js(request.url)}, {`)
  lines.push(`  method: ${js(request.method)},`)
  if (headers.length) lines.push('  headers: {', ...headers.map((h) => `${jsHeaderLine(h)},`), '  },')
  if (body.kind === 'json') lines.push(`  body: ${body.value !== undefined ? `JSON.stringify(${jsValue(body.value, '  ')})` : js(body.text)},`)
  else if (body.kind === 'form') lines.push(`  body: new URLSearchParams(${formValue(body.fields)}),`)
  else if (body.kind === 'raw') lines.push(`  body: ${js(body.text)},`)
  else if (body.kind === 'multipart') lines.push('  body: form,')
  if (!request.followRedirects) lines.push("  redirect: 'manual',")
  if (request.timeout) lines.push(`  signal: AbortSignal.timeout(${request.timeout * 1000}),`)
  lines.push('})')
  lines.push(request.method === 'HEAD' ? 'console.log(response.status, [...response.headers])' : 'const data = await response.text()')
  return lines.join('\n')
}

export function toAxios(request: CurlConverterRequest): string {
  const lines: string[] = ["import axios from 'axios'", '']
  const headers = headersFor(request, false)
  const { body } = request
  if (body.kind === 'multipart') lines.push(...formDataLines(body.parts))
  lines.push('const response = await axios({')
  lines.push(`  method: ${js(request.method.toLowerCase())},`)
  lines.push(`  url: ${js(request.url)},`)
  if (headers.length) lines.push('  headers: {', ...headers.map((h) => `${jsHeaderLine(h)},`), '  },')
  if (request.auth) lines.push(`  auth: { username: ${js(request.auth.user)}, password: ${js(request.auth.password)} },`)
  if (body.kind === 'json') lines.push(`  data: ${body.value !== undefined ? jsValue(body.value, '  ') : js(body.text)},`)
  else if (body.kind === 'form') lines.push(`  data: new URLSearchParams(${formValue(body.fields)}),`)
  else if (body.kind === 'raw') lines.push(`  data: ${js(body.text)},`)
  else if (body.kind === 'multipart') lines.push('  data: form,')
  if (!request.followRedirects) lines.push('  maxRedirects: 0,')
  if (request.timeout) lines.push(`  timeout: ${request.timeout * 1000},`)
  lines.push('})')
  return lines.join('\n')
}

export function toPython(request: CurlConverterRequest): string {
  const lines: string[] = ['import requests', '']
  const headers = request.headers.filter(([n]) => !(request.body.kind === 'multipart' && n.toLowerCase() === 'content-type'))
  const args: string[] = [py(request.url)]
  const { body } = request
  if (headers.length) {
    lines.push('headers = {', ...headers.map(([n, v]) => `    ${py(n)}: ${py(v)},`), '}', '')
    args.push('headers=headers')
  }
  if (request.cookies) {
    const pairs = request.cookies.split(';').map((c) => c.trim()).filter(Boolean).map((c) => {
      const eq = c.indexOf('=')
      return `    ${py(c.slice(0, eq))}: ${py(c.slice(eq + 1))},`
    })
    lines.push('cookies = {', ...pairs, '}', '')
    args.push('cookies=cookies')
  }
  if (body.kind === 'json' && body.value !== undefined) {
    lines.push(`json_data = ${pyValue(body.value, '')}`, '')
    args.push('json=json_data')
  } else if (body.kind === 'json' || body.kind === 'raw') {
    lines.push(`data = ${py(body.text)}`, '')
    args.push('data=data')
  } else if (body.kind === 'form') {
    // A repeated name needs a list of pairs; a dict would keep only the last.
    const repeated = new Set(body.fields.map(([k]) => k)).size !== body.fields.length
    if (repeated) lines.push('data = [', ...body.fields.map(([k, v]) => `    (${py(k)}, ${py(v)}),`), ']', '')
    else lines.push('data = {', ...body.fields.map(([k, v]) => `    ${py(k)}: ${py(v)},`), '}', '')
    args.push('data=data')
  } else if (body.kind === 'multipart') {
    lines.push(
      'files = {',
      ...body.parts.map((part) =>
        part.file
          ? `    ${py(part.name)}: (${py(part.file.split('/').pop() ?? part.file)}, open(${py(part.file)}, 'rb')${part.contentType ? `, ${py(part.contentType)}` : ''}),`
          : `    ${py(part.name)}: (None, ${py(part.value)}),`,
      ),
      '}',
      '',
    )
    args.push('files=files')
  }
  if (request.auth) args.push(`auth=(${py(request.auth.user)}, ${py(request.auth.password)})`)
  if (request.insecure) args.push('verify=False')
  if (request.timeout) args.push(`timeout=${request.timeout}`)
  // requests follows redirects except for HEAD; curl follows none without -L.
  if (!request.followRedirects && request.method !== 'HEAD') args.push('allow_redirects=False')
  const method = request.method.toLowerCase()
  const known = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)
  lines.push(known ? `response = requests.${method}(` : `response = requests.request(${py(request.method)},`)
  lines.push(...args.map((a) => `    ${a},`), ')')
  return lines.join('\n')
}
