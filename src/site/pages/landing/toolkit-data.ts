import type {
  CommitGraphCommit,
  ErrorBudgetSample,
  FormulaEditorValue,
  HexbinChartPoint,
  TraceWaterfallSpan,
} from 'klyvui'

/**
 * The data the front page's specimens run on. Seeded, so every visitor and
 * every render sees the same charts, and built on first use, so none of it is
 * computed until the tab that needs it opens.
 */

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(random: () => number) {
  const u = Math.max(1e-12, random())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

function once<T>(make: () => T) {
  let value: T | undefined
  return () => (value ??= make())
}

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
export const EPOCH = Date.UTC(2026, 8, 1)

/* ------------------------------------------------------------ observability */

/** One checkout request across five services, with the slow query in it. */
export const TRACE: TraceWaterfallSpan[] = [
  { id: 'root', name: 'POST /checkout', service: 'gateway', start: 0, duration: 842, attributes: { 'http.status': 200, region: 'eu-west-1' } },
  { id: 'auth', parentId: 'root', name: 'verify session', service: 'auth', start: 6, duration: 48 },
  { id: 'redis', parentId: 'auth', name: 'GET session:*', service: 'redis', start: 12, duration: 9 },
  { id: 'cart', parentId: 'root', name: 'load cart', service: 'orders', start: 58, duration: 214 },
  { id: 'sql', parentId: 'cart', name: 'SELECT line_items', service: 'postgres', start: 64, duration: 188, attributes: { rows: 14, 'db.plan': 'seq scan' } },
  { id: 'price', parentId: 'root', name: 'price order', service: 'pricing', start: 276, duration: 131 },
  { id: 'tax', parentId: 'price', name: 'tax quote', service: 'pricing', start: 284, duration: 92 },
  { id: 'pay', parentId: 'root', name: 'charge card', service: 'payments', start: 412, duration: 396, attributes: { provider: 'stripe', attempt: 2 } },
  { id: 'retry', parentId: 'pay', name: 'POST /v1/charges', service: 'payments', start: 418, duration: 170, status: 'error', attributes: { 'http.status': 502 } },
  { id: 'retry2', parentId: 'pay', name: 'POST /v1/charges', service: 'payments', start: 602, duration: 198 },
  { id: 'emit', parentId: 'root', name: 'publish order.created', service: 'orders', start: 812, duration: 22 },
]

/** The same request, as collapsed stacks — the format FlameGraph reads. */
export const PROFILE = [
  'server;route;auth;verifyToken 38',
  'server;route;auth;loadSession;redis.get 64',
  'server;route;handler;parseBody 41',
  'server;route;handler;query;planner 96',
  'server;route;handler;query;execute;scan 214',
  'server;route;handler;query;execute;sort 73',
  'server;route;handler;serialize 57',
  'server;route;render;template 88',
  'server;route;render;hydrate 35',
  'server;gc 29',
].join('\n')

/** Eighteen days of checkout traffic in five-minute buckets, with two incidents. */
export const budgetSamples = once<ErrorBudgetSample[]>(() => {
  const random = rng(7)
  const buckets = (18 * DAY) / (5 * MINUTE)
  const samples: ErrorBudgetSample[] = []
  for (let i = 0; i < buckets; i++) {
    const time = EPOCH + i * 5 * MINUTE
    const hour = new Date(time).getUTCHours()
    const requests = Math.round(1800 + 1400 * Math.sin(((hour - 6) / 24) * Math.PI * 2) + random() * 300)
    const day = i / 288
    const incident = (day > 6.2 && day < 6.3) || (day > 13.55 && day < 13.62)
    const rate = incident ? 0.04 + random() * 0.03 : 0.0003 + random() * 0.0005
    samples.push({ time, requests, errors: Math.round(requests * rate) })
  }
  return samples
})

export const BUDGET_WINDOW = 30 * DAY

/* ---------------------------------------------------------------- analytics */

/** Eight weeks of daily sign-ups: growing, with quiet weekends. */
export const signups = once(() => {
  const random = rng(11)
  const week = [1.08, 1.14, 1.12, 1.06, 0.98, 0.72, 0.68]
  return Array.from({ length: 56 }, (_, day) => Math.round((420 + day * 4.2) * week[day % 7] + gaussian(random) * 14))
})

const WEEKDAY = ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon']
export const signupDay = (index: number) => `${WEEKDAY[index % 7]} ${Math.floor(index / 7) + 1}`

/** Response time against payload size, for a few thousand requests. */
export const latency = once<HexbinChartPoint[]>(() => {
  const random = rng(23)
  return Array.from({ length: 2600 }, () => {
    const size = Math.max(1, Math.exp(3.2 + gaussian(random) * 0.7))
    const slow = random() < 0.08 ? 180 + random() * 220 : 0
    return { x: Math.min(160, size), y: Math.max(8, 30 + size * 0.9 + gaussian(random) * 16 + slow) }
  })
})

/** A quote's line items, for the formula to read. */
export const QUOTE_CELLS: Record<string, FormulaEditorValue> = {
  A1: 'Seats',
  B1: 24,
  C1: 18,
  A2: 'Storage (TB)',
  B2: 3,
  C2: 40,
  A3: 'Support',
  B3: 1,
  C3: 290,
}

/* ------------------------------------------------------------ developer tools */

export const REGEX = '(?<level>ERROR|WARN) \\[(?<service>[a-z-]+)\\] (?<message>.+)'
export const LOG_LINES = [
  '09:41:02 INFO  [gateway] POST /checkout 200 842ms',
  '09:41:02 WARN [payments] retrying charge after 502 from provider',
  '09:41:03 ERROR [orders] line_items query exceeded 150ms budget',
  '09:41:05 INFO  [auth] session refreshed for u_2841',
  '09:41:07 ERROR [pricing] tax quote timed out for region eu-west-1',
].join('\n')

/* --------------------------------------------------------------- code review */

export const MERGE_BASE = `export const plans = {
  starter: { price: 9, seats: 3 },
  team: { price: 29, seats: 10 },
}

export const trialDays = 14`

export const MERGE_OURS = `export const plans = {
  starter: { price: 12, seats: 3 },
  team: { price: 29, seats: 10 },
}

export const trialDays = 14`

export const MERGE_THEIRS = `export const plans = {
  starter: { price: 10, seats: 5 },
  team: { price: 29, seats: 10 },
  scale: { price: 99, seats: 50 },
}

export const trialDays = 30`

export const COMMITS: CommitGraphCommit[] = [
  { hash: 'e6eaff1c', parents: ['6b443ee3', 'c80ba4f2'], message: 'Merge branch “showpieces”', author: 'Mara Lindqvist', date: 'Sep 21', refs: ['main'] },
  { hash: 'c80ba4f2', parents: ['c15b9a7f'], message: 'Sand, magnets, spectra and a fourth dimension', author: 'Ade Okonkwo', date: 'Sep 21', refs: ['showpieces'] },
  { hash: '6b443ee3', parents: ['4564ef60'], message: 'Front page sections for the showpieces', author: 'Jonas Field', date: 'Sep 21' },
  { hash: 'c15b9a7f', parents: ['4564ef60'], message: 'Ten showpieces, with a tag of their own', author: 'Ade Okonkwo', date: 'Sep 20' },
  { hash: '4564ef60', parents: ['647f4e02'], message: 'Seventy components the library lacked', author: 'Mara Lindqvist', date: 'Sep 19' },
  { hash: '647f4e02', parents: [], message: 'A theme engine, and a customiser for it', author: 'Jonas Field', date: 'Sep 18', tags: ['v1.0.0'] },
]

export const CONFIG_BEFORE = {
  service: 'checkout',
  replicas: 3,
  timeouts: { upstream: 800, idle: 30 },
  flags: ['new-pricing'],
}

export const CONFIG_AFTER = {
  service: 'checkout',
  replicas: 5,
  timeouts: { upstream: 1200, idle: 30 },
  flags: ['new-pricing', 'retry-charges'],
  region: 'eu-west-1',
}
