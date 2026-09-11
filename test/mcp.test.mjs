// Drives the MCP server the way a harness does: spawn it, speak newline
// delimited JSON-RPC over stdio, assert on what comes back.
//
// Plain node --test rather than vitest, because the point is to exercise the
// real process boundary — a server that only works when imported is a server
// that does not work.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'mcp', 'server.mjs')

/** Sends every request down one stdin, resolves when every id has answered. */
function converse(requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] })
    const wanted = new Set(requests.filter((r) => r.id !== undefined).map((r) => r.id))
    const responses = new Map()
    let buffer = ''
    let stderr = ''

    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    child.stdout.on('data', (chunk) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        const message = JSON.parse(line)
        responses.set(message.id, message)
        wanted.delete(message.id)
      }
      if (wanted.size === 0) {
        child.stdin.end()
        child.kill()
        resolve(responses)
      }
    })

    child.on('error', reject)
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`timed out; still waiting on ${[...wanted]}. stderr: ${stderr}`))
    }, 15000)
    timer.unref()

    for (const request of requests) child.stdin.write(`${JSON.stringify(request)}\n`)
  })
}

const rpc = (id, method, params) => ({ jsonrpc: '2.0', id, method, params })
const call = (id, name, args = {}) => rpc(id, 'tools/call', { name, arguments: args })
/** Tool results arrive as text content; JSON ones are stringified. */
const payload = (response) => {
  const text = response.result.content[0].text
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

test('handshake reports the server and echoes the protocol version', async () => {
  const out = await converse([
    rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } }),
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    rpc(2, 'ping', {}),
  ])

  assert.equal(out.get(1).result.serverInfo.name, 'citrine')
  assert.equal(out.get(1).result.protocolVersion, '2025-06-18')
  assert.ok(out.get(1).result.capabilities.tools, 'declares tools')
  assert.deepEqual(out.get(2).result, {}, 'ping answers, so the notification did not derail it')
})

test('every advertised tool has a schema and actually runs', async () => {
  const listed = await converse([rpc(1, 'tools/list', {})])
  const tools = listed.get(1).result.tools
  assert.ok(tools.length >= 7, `expected the full toolset, got ${tools.length}`)

  for (const tool of tools) {
    assert.ok(tool.description?.length > 20, `${tool.name} needs a real description`)
    assert.equal(tool.inputSchema.type, 'object', `${tool.name} schema`)
  }

  // Call each one with its required arguments filled in, and assert none errors.
  const args = { name: 'DataTable' }
  const calls = tools.map((tool, index) =>
    call(index + 1, tool.name, Object.fromEntries(
      (tool.inputSchema.required ?? []).map((key) => [key, args[key]]),
    )),
  )
  const out = await converse(calls)
  for (const [index, tool] of tools.entries()) {
    const response = out.get(index + 1)
    assert.ok(response.result, `${tool.name} returned no result`)
    assert.ok(!response.result.isError, `${tool.name} errored: ${response.result.content?.[0]?.text}`)
    assert.ok(response.result.content[0].text.length > 0, `${tool.name} returned nothing`)
  }
})

test('a component resolves by name, by slug and case-insensitively', async () => {
  const out = await converse([
    call(1, 'get_component', { name: 'DataTable' }),
    call(2, 'get_component', { name: 'data-table' }),
    call(3, 'get_component', { name: 'datatable' }),
    call(4, 'get_component', { name: 'no-such-component' }),
  ])

  const canonical = payload(out.get(1))
  assert.equal(canonical.name, 'DataTable')
  assert.ok(canonical.props.length > 0, 'has props')
  assert.ok(canonical.props.every((p) => p.name && p.type), 'every prop has a name and a type')
  assert.match(canonical.import, /import \{ DataTable \} from 'citrine'/)
  assert.ok(canonical.size, 'carries its gzipped size')

  assert.deepEqual(payload(out.get(2)), canonical, 'slug resolves to the same component')
  assert.deepEqual(payload(out.get(3)), canonical, 'lowercase resolves to the same component')

  const missing = payload(out.get(4))
  assert.ok(missing.error, 'unknown name is reported, not thrown')
  assert.ok(Array.isArray(missing.didYouMean), 'and suggests alternatives')
})

test('source comes back real, and with dependencies it compiles as a set', async () => {
  const out = await converse([
    call(1, 'get_component_source', { name: 'DataTable' }),
    call(2, 'get_component_source', { name: 'DataTable', withDependencies: true }),
  ])

  const bare = payload(out.get(1))
  assert.ok(bare.files.length >= 1)
  assert.match(bare.files[0].source, /export/, 'is actual source')

  const full = payload(out.get(2))
  assert.ok(full.files.length > bare.files.length, 'dependencies add files')
  assert.ok(full.files.every((f) => f.source.length > 0), 'no file came back empty')
})

test('search finds by job, not just by name', async () => {
  const out = await converse([
    call(1, 'search_components', { query: 'table' }),
    call(2, 'search_components', {}),
    call(3, 'search_components', { query: 'data table' }),
    call(4, 'search_components', { query: 'datatable' }),
  ])

  assert.ok(payload(out.get(1)).some((entry) => entry.name === 'DataTable'))
  // However someone spaces it, it is the same search.
  for (const id of [3, 4]) {
    assert.ok(
      payload(out.get(id)).some((entry) => entry.name === 'DataTable'),
      `query ${id} should reach DataTable`,
    )
  }
  const all = payload(out.get(2))
  assert.ok(all.length > 200, `an empty query lists everything, got ${all.length}`)
  assert.ok(all.every((entry) => entry.summary), 'every entry is described')
})

test('tokens and rules are served as resources too', async () => {
  const out = await converse([
    rpc(1, 'resources/list', {}),
    rpc(2, 'resources/read', { uri: 'citrine://tokens' }),
    rpc(3, 'resources/read', { uri: 'citrine://nope' }),
    call(4, 'get_design_tokens', { group: 'color' }),
  ])

  assert.ok(out.get(1).result.resources.length >= 4)
  const tokens = JSON.parse(out.get(2).result.contents[0].text)
  assert.ok(tokens.color.accent, 'the accent token is there')
  assert.ok(tokens.$modes.dark, 'dark mode ships as a mode')

  assert.ok(out.get(3).error, 'an unknown resource is a JSON-RPC error')

  const filtered = payload(out.get(4))
  assert.ok(filtered.color && !filtered.radius, 'group filter narrows the result')
})

test('blocks are listed, found by slug or name, and come with their source', async () => {
  const out = await converse([
    call(1, 'list_blocks', {}),
    call(2, 'get_block', { name: 'dashboard' }),
    call(3, 'get_block', { name: 'Two-factor' }),
    call(4, 'get_block', { name: 'no-such-block' }),
    call(5, 'list_blocks', { category: 'Authentication' }),
    rpc(6, 'resources/read', { uri: 'citrine://blocks' }),
  ])

  const all = payload(out.get(1))
  assert.ok(all.length >= 8, `expected every block, got ${all.length}`)
  assert.ok(all.every((block) => block.cli.startsWith('npx citrine add block ')))

  const dashboard = payload(out.get(2))
  assert.equal(dashboard.slug, 'dashboard')
  assert.ok(dashboard.components.includes('AppShell'), 'components are read off the imports')
  assert.ok(dashboard.packages.includes('citrine'))
  assert.match(dashboard.source, /export default function DashboardBlock/, 'the real file comes back')

  assert.equal(payload(out.get(3)).slug, 'authentication', 'the display name resolves too')

  const missing = payload(out.get(4))
  assert.ok(missing.error && missing.blocks.includes('login'), 'a miss lists what does exist')

  assert.ok(payload(out.get(5)).every((block) => block.category === 'Authentication'))
  assert.ok(JSON.parse(out.get(6).result.contents[0].text).length >= 8, 'the resource carries them too')
})

test('bad input is answered, never fatal', async () => {
  const out = await converse([
    rpc(1, 'tools/call', { name: 'does_not_exist', arguments: {} }),
    rpc(2, 'no/such/method', {}),
    rpc(3, 'tools/list', {}),
  ])

  assert.equal(out.get(1).error.code, -32602)
  assert.equal(out.get(2).error.code, -32601)
  assert.ok(out.get(3).result, 'the server is still serving afterwards')
})
