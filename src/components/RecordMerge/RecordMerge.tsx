'use client'

import { useId, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'

export interface RecordMergeRecord {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  company?: string
  /** When the record last changed, as an ISO string. Drives the “most recent” rule. */
  updatedAt: string
}

export type RecordMergeField = 'name' | 'email' | 'phone' | 'address' | 'company'
export type RecordMergeRule = 'recent' | 'complete'

export interface RecordMergeWeights {
  name: number
  email: number
  phone: number
  address: number
}

export interface RecordMergeLink {
  /** The record that was merged away. */
  from: string
  /** The surviving record it now points to. */
  to: string
}

export interface RecordMergeResult {
  /** The surviving record, with each field chosen by its rule or by hand. */
  record: RecordMergeRecord
  mergedIds: string[]
  links: RecordMergeLink[]
}

export interface RecordMergeProps {
  records: RecordMergeRecord[]
  /** Weighted score, 0 to 1, at which two records are linked. */
  threshold?: number
  /** How much each field counts. Only fields both records have are scored. */
  weights?: Partial<RecordMergeWeights>
  /** Survivorship rule per field, before any hand-picked value. */
  defaultRules?: Partial<Record<RecordMergeField, RecordMergeRule>>
  /** Called when a cluster is merged. */
  onMerge?: (result: RecordMergeResult) => void
  /** Called when a cluster is marked as not duplicates. */
  onReject?: (ids: string[]) => void
  /** Merged last, so it wins. */
  className?: string
}

const FIELDS: RecordMergeField[] = ['name', 'email', 'phone', 'address', 'company']
const LABELS: Record<RecordMergeField, string> = { name: 'Name', email: 'Email', phone: 'Phone', address: 'Address', company: 'Company' }
const WEIGHTS: RecordMergeWeights = { name: 0.4, email: 0.25, phone: 0.2, address: 0.15 }

/* ------------------------------------------------------------------ similarity */

const NICKNAMES: Record<string, string> = {
  bob: 'robert', rob: 'robert', bobby: 'robert', bill: 'william', will: 'william', liz: 'elizabeth', beth: 'elizabeth',
  kate: 'katherine', katie: 'katherine', kathy: 'katherine', jim: 'james', jimmy: 'james', mike: 'michael', tom: 'thomas',
  dave: 'david', chris: 'christopher', alex: 'alexander', sam: 'samuel', dan: 'daniel', jen: 'jennifer', jenny: 'jennifer',
  matt: 'matthew', nick: 'nicholas', tony: 'anthony', steve: 'steven', andy: 'andrew', joe: 'joseph', pat: 'patricia', peggy: 'margaret',
}

const plain = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** “Smith, Bob Jr.” → “robert smith”: order, case, accents, titles and nicknames removed. */
function normalName(name: string) {
  let text = plain(name).trim()
  if (text.includes(',')) {
    const [last, first] = text.split(',', 2)
    text = `${first} ${last}`
  }
  return text
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !['mr', 'mrs', 'ms', 'dr', 'jr', 'sr', 'ii', 'iii'].includes(token))
    .map((token) => NICKNAMES[token] ?? token)
    .join(' ')
}

/** Gmail ignores dots and plus-tags; everyone ignores case. */
function normalEmail(email = '') {
  const [local = '', domain = ''] = email.trim().toLowerCase().split('@')
  if (!domain) return ''
  const base = local.split('+')[0]
  return `${/^(gmail|googlemail)\.com$/.test(domain) ? base.replace(/\./g, '') : base}@${domain.replace('googlemail.com', 'gmail.com')}`
}

/** Digits only, national number: a leading 1 on an 11-digit number is the country code. */
function normalPhone(phone = '') {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits
}

const ADDRESS_WORDS: Record<string, string> = {
  st: 'street', str: 'street', ave: 'avenue', av: 'avenue', rd: 'road', blvd: 'boulevard', dr: 'drive', ln: 'lane', ct: 'court',
  apt: 'apartment', ste: 'suite', fl: 'floor', n: 'north', s: 'south', e: 'east', w: 'west', hwy: 'highway', pl: 'place',
}
const addressTokens = (address = '') => plain(address).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).map((token) => ADDRESS_WORDS[token] ?? token)

/** Jaro–Winkler: transposition-tolerant, and generous to a shared prefix — which is how names differ. */
export function recordMergeJaroWinkler(a: string, b: string) {
  if (a === b) return a ? 1 : 0
  if (!a || !b) return 0
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1)
  const usedA = new Array(a.length).fill(false)
  const usedB = new Array(b.length).fill(false)
  let matches = 0
  for (let i = 0; i < a.length; i += 1) {
    for (let j = Math.max(0, i - window); j < Math.min(b.length, i + window + 1); j += 1) {
      if (usedB[j] || a[i] !== b[j]) continue
      usedA[i] = usedB[j] = true
      matches += 1
      break
    }
  }
  if (!matches) return 0
  let transpositions = 0
  for (let i = 0, j = 0; i < a.length; i += 1) {
    if (!usedA[i]) continue
    while (!usedB[j]) j += 1
    if (a[i] !== b[j]) transpositions += 1
    j += 1
  }
  const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3
  let prefix = 0
  while (prefix < 4 && a[prefix] === b[prefix]) prefix += 1
  return jaro + prefix * 0.1 * (1 - jaro)
}

/** Indel similarity, 2·LCS / total length — the `ratio` the token-set ratio is built on. */
function ratio(a: string, b: string) {
  if (!a.length && !b.length) return 1
  const row = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = 0
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j]
      row[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : Math.max(row[j], row[j - 1])
      diagonal = above
    }
  }
  return (2 * row[b.length]) / (a.length + b.length)
}

/**
 * Token-set ratio: compare the shared words against each side’s shared words
 * plus its extras, and keep the best. “12 Oak St Apt 4” and “Apt 4, 12 Oak
 * Street” score 1 — word order and abbreviations stop mattering.
 */
export function recordMergeTokenSetRatio(a: string, b: string) {
  const left = new Set(addressTokens(a))
  const right = new Set(addressTokens(b))
  const shared = [...left].filter((token) => right.has(token)).sort().join(' ')
  const onlyLeft = [...left].filter((token) => !right.has(token)).sort().join(' ')
  const onlyRight = [...right].filter((token) => !left.has(token)).sort().join(' ')
  const t1 = [shared, onlyLeft].filter(Boolean).join(' ')
  const t2 = [shared, onlyRight].filter(Boolean).join(' ')
  return Math.max(shared ? ratio(shared, t1) : 0, shared ? ratio(shared, t2) : 0, ratio(t1, t2))
}

function nameScore(a: string, b: string) {
  const x = normalName(a)
  const y = normalName(b)
  const sorted = (text: string) => text.split(' ').sort().join(' ')
  return Math.max(recordMergeJaroWinkler(x, y), recordMergeJaroWinkler(sorted(x), sorted(y)))
}

interface PairScore {
  a: string
  b: string
  score: number
  parts: Partial<Record<keyof RecordMergeWeights, number>>
}

function compare(a: RecordMergeRecord, b: RecordMergeRecord, weights: RecordMergeWeights): PairScore {
  const parts: PairScore['parts'] = { name: nameScore(a.name, b.name) }
  const emailA = normalEmail(a.email)
  const emailB = normalEmail(b.email)
  if (emailA && emailB) parts.email = emailA === emailB ? 1 : 0
  const phoneA = normalPhone(a.phone)
  const phoneB = normalPhone(b.phone)
  if (phoneA && phoneB) parts.phone = phoneA === phoneB ? 1 : 0
  if (a.address && b.address) parts.address = recordMergeTokenSetRatio(a.address, b.address)
  let total = 0
  let weight = 0
  for (const [field, value] of Object.entries(parts) as [keyof RecordMergeWeights, number][]) {
    total += value * weights[field]
    weight += weights[field]
  }
  return { a: a.id, b: b.id, score: weight ? total / weight : 0, parts }
}

/** American Soundex, for a surname block that survives misspelling. */
function soundex(word: string) {
  const codes: Record<string, string> = { b: '1', f: '1', p: '1', v: '1', c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2', d: '3', t: '3', l: '4', m: '5', n: '5', r: '6' }
  const letters = word.replace(/[^a-z]/g, '')
  if (!letters) return ''
  let out = letters[0].toUpperCase()
  let last = codes[letters[0]] ?? ''
  for (const letter of letters.slice(1)) {
    const code = codes[letter] ?? ''
    if (code && code !== last) out += code
    if (letter !== 'h' && letter !== 'w') last = code
  }
  return (out + '000').slice(0, 4)
}

/** Records that share any key are compared; nothing else is. */
function blockKeys(record: RecordMergeRecord) {
  const tokens = normalName(record.name).split(' ')
  const keys = [`n:${tokens[0]?.[0] ?? ''}${soundex(tokens[tokens.length - 1] ?? '')}`]
  const email = normalEmail(record.email)
  if (email) keys.push(`e:${email}`)
  const phone = normalPhone(record.phone)
  if (phone.length >= 7) keys.push(`p:${phone.slice(-7)}`)
  return keys
}

function cluster(records: RecordMergeRecord[], weights: RecordMergeWeights, threshold: number) {
  const blocks = new Map<string, number[]>()
  records.forEach((record, index) => {
    for (const key of blockKeys(record)) blocks.set(key, [...(blocks.get(key) ?? []), index])
  })
  const seen = new Set<string>()
  const pairs: PairScore[] = []
  for (const members of blocks.values()) {
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        const key = `${Math.min(members[i], members[j])}:${Math.max(members[i], members[j])}`
        if (seen.has(key)) continue
        seen.add(key)
        pairs.push(compare(records[members[i]], records[members[j]], weights))
      }
    }
  }

  // Union–find with path halving: linked pairs join, and chains join transitively.
  const parent = new Map(records.map((record) => [record.id, record.id]))
  const find = (id: string): string => {
    let at = id
    while (parent.get(at) !== at) {
      parent.set(at, parent.get(parent.get(at)!)!)
      at = parent.get(at)!
    }
    return at
  }
  const linked = pairs.filter((pair) => pair.score >= threshold)
  for (const pair of linked) parent.set(find(pair.a), find(pair.b))

  const groups = new Map<string, string[]>()
  for (const record of records) groups.set(find(record.id), [...(groups.get(find(record.id)) ?? []), record.id])
  const clusters = [...groups.values()]
    .filter((ids) => ids.length > 1)
    .map((ids) => {
      const edges = linked.filter((pair) => ids.includes(pair.a))
      return { key: ids.slice().sort().join('|'), ids, edges, score: Math.max(...edges.map((edge) => edge.score)) }
    })
    .sort((a, b) => b.score - a.score)
  const total = (records.length * (records.length - 1)) / 2
  return { clusters, compared: pairs.length, total }
}

/* ------------------------------------------------------------------ survivorship */

const valueOf = (record: RecordMergeRecord, field: RecordMergeField) => (record[field] ?? '').trim()
const time = (record: RecordMergeRecord) => Date.parse(record.updatedAt) || 0

function survivorFor(records: RecordMergeRecord[], field: RecordMergeField, rule: RecordMergeRule) {
  const withValue = records.filter((record) => valueOf(record, field)).sort((a, b) => time(b) - time(a))
  if (rule === 'recent' || withValue.length < 2) return withValue[0]
  // Most complete: most digits for a phone, most words then most characters for text.
  const measure = (record: RecordMergeRecord) => {
    const value = valueOf(record, field)
    return field === 'phone' ? value.replace(/\D/g, '').length * 1000 : value.split(/\s+/).length * 1000 + value.length
  }
  return withValue.reduce((best, record) => (measure(record) > measure(best) ? record : best))
}

interface Decision {
  status: 'pending' | 'merged' | 'rejected'
  excluded: string[]
  picks: Partial<Record<RecordMergeField, string>>
  result?: RecordMergeResult
}

const pct = (value: number) => `${Math.round(value * 100)}%`

/**
 * Finds the duplicates in a set of records, then lets someone decide.
 *
 * Matching is the classic record-linkage pipeline rather than one fuzzy
 * string compare. Blocking keys — first initial plus surname Soundex, the
 * normalised email, the last seven phone digits — decide which pairs are
 * compared at all, so the work grows with the duplicates, not the square of
 * the table. Each field then gets the comparison that suits it: Jaro–Winkler
 * for names (after nicknames and “Last, First” are normalised), exact match
 * for normalised emails and phones, and a token-set ratio for addresses. The
 * weighted score links pairs, and union–find turns links into clusters, so
 * A≈B and B≈C put all three together.
 *
 * Merging is a review, not a button: each cluster shows why it matched, any
 * record can be left out, and each field’s surviving value follows a rule —
 * most recent or most complete — until someone picks one by hand.
 */
export function RecordMerge({ records, threshold = 0.8, weights: weightProp, defaultRules, onMerge, onReject, className }: RecordMergeProps) {
  const weights = { ...WEIGHTS, ...weightProp }
  const weightKey = JSON.stringify(weights)
  const { clusters, compared, total } = useMemo(() => cluster(records, weights, threshold), [records, threshold, weightKey])
  const [rules, setRules] = useState<Record<RecordMergeField, RecordMergeRule>>(() => ({
    name: 'complete',
    email: 'recent',
    phone: 'recent',
    address: 'complete',
    company: 'recent',
    ...defaultRules,
  }))
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [message, setMessage] = useState('')
  const id = useId()
  const byId = useMemo(() => new Map(records.map((record) => [record.id, record])), [records])

  const decisionFor = (key: string): Decision => decisions[key] ?? { status: 'pending', excluded: [], picks: {} }
  const update = (key: string, change: Partial<Decision>) => setDecisions((all) => ({ ...all, [key]: { ...decisionFor(key), ...all[key], ...change } }))

  const golden = (ids: string[], decision: Decision) => {
    const members = ids.filter((memberId) => !decision.excluded.includes(memberId)).map((memberId) => byId.get(memberId)!)
    const sources = {} as Record<RecordMergeField, string | undefined>
    for (const field of FIELDS) {
      const picked = decision.picks[field]
      sources[field] = picked && members.some((member) => member.id === picked) ? picked : survivorFor(members, field, rules[field])?.id
    }
    const survivor = members.slice().sort((a, b) => time(b) - time(a))[0]
    const record: RecordMergeRecord = { ...survivor }
    for (const field of FIELDS) {
      const source = sources[field] ? byId.get(sources[field]!) : undefined
      if (field === 'name') record.name = source ? source.name : survivor.name
      else record[field] = source ? valueOf(source, field) : undefined
    }
    record.updatedAt = survivor.updatedAt
    return { record, sources, members, survivor }
  }

  const pending = clusters.filter((item) => decisionFor(item.key).status === 'pending').length

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] font-medium text-ink-soft">
        <p className="m-0">
          <strong className="font-bold text-ink">{clusters.length}</strong> possible {clusters.length === 1 ? 'duplicate' : 'duplicates'} among {records.length} records ·{' '}
          {pending} to review
        </p>
        <p className="m-0 tabular-nums">
          Blocking compared {compared} of {total} pairs
        </p>
      </div>

      <fieldset className="m-0 flex flex-col gap-2 rounded-[var(--radius-tile)] border border-line p-3">
        <legend className="px-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Which value survives</legend>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field} className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-ink">{LABELS[field]}</span>
              <SegmentedControl
                size="sm"
                label={`${LABELS[field]} survivorship`}
                value={rules[field]}
                onValueChange={(rule) => setRules({ ...rules, [field]: rule })}
                options={[
                  { value: 'recent', label: 'Most recent' },
                  { value: 'complete', label: 'Most complete' },
                ]}
              />
            </div>
          ))}
        </div>
        <p className="m-0 text-[11px] font-medium text-ink-faint">Pick a cell in any cluster to override the rule for that field.</p>
      </fieldset>

      {clusters.length === 0 && (
        <p className="m-0 rounded-[var(--radius-tile)] border border-dashed border-line-strong p-6 text-center text-[13px] font-medium text-ink-soft">
          No pair scores {pct(threshold)} or more. Lower the threshold to see weaker matches.
        </p>
      )}

      {clusters.map((item, index) => {
        const decision = decisionFor(item.key)
        const headingId = `${id}-cluster-${index}`
        const { record, sources, members, survivor } = golden(item.ids, decision)
        return (
          <section key={item.key} aria-labelledby={headingId} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id={headingId} className="m-0 text-[14px] font-bold text-ink">
                Cluster {index + 1} · {item.ids.length} records · best match {pct(item.score)}
              </h3>
              <Badge tone={decision.status === 'merged' ? 'accent' : 'neutral'}>
                {decision.status === 'merged' ? 'Merged' : decision.status === 'rejected' ? 'Kept separate' : 'Needs review'}
              </Badge>
            </div>

            {decision.status === 'pending' ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
                    <caption className="sr-only">Records in cluster {index + 1}. Choose which value survives for each field.</caption>
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-ink-faint">
                        <th scope="col" className="py-1.5 pr-2 font-bold">Include</th>
                        <th scope="col" className="py-1.5 pr-2 font-bold">Record</th>
                        {FIELDS.map((field) => (
                          <th key={field} scope="col" className="py-1.5 pr-2 font-bold">
                            {LABELS[field]}
                            {decision.picks[field] ? <span className="ml-1 normal-case tracking-normal text-ink-soft">(manual)</span> : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {item.ids.map((recordId) => {
                        const row = byId.get(recordId)!
                        const included = !decision.excluded.includes(recordId)
                        return (
                          <tr key={recordId} className={cn('border-t border-line align-top', !included && 'opacity-50')}>
                            <td className="py-2 pr-2">
                              <input
                                type="checkbox"
                                checked={included}
                                aria-label={`Include ${recordId}`}
                                disabled={included && members.length <= 2}
                                onChange={() =>
                                  update(item.key, {
                                    excluded: included ? [...decision.excluded, recordId] : decision.excluded.filter((other) => other !== recordId),
                                  })
                                }
                                className="size-4 accent-[var(--color-accent-strong)]"
                              />
                            </td>
                            <th scope="row" className="py-2 pr-2 font-normal">
                              <span className="block font-mono text-[11px] font-bold text-ink">{recordId}</span>
                              <span className="block text-[11px] text-ink-faint">{row.updatedAt.slice(0, 10)}</span>
                              {row.id === survivor?.id && <span className="block text-[10px] font-bold uppercase text-ink-soft">Survivor</span>}
                            </th>
                            {FIELDS.map((field) => {
                              const value = valueOf(row, field)
                              const chosen = sources[field] === recordId
                              return (
                                <td key={field} className="py-2 pr-2">
                                  {value ? (
                                    <label className={cn('flex cursor-pointer items-start gap-1.5 rounded-[var(--radius-6)] px-1 py-0.5', chosen && 'bg-[color-mix(in_oklab,var(--color-accent)_30%,transparent)]')}>
                                      <input
                                        type="radio"
                                        name={`${id}-${index}-${field}`}
                                        checked={chosen}
                                        disabled={!included}
                                        onChange={() => {
                                          update(item.key, { picks: { ...decision.picks, [field]: recordId } })
                                          setMessage(`${LABELS[field]} will be ${value}.`)
                                        }}
                                        className="mt-0.5 accent-[var(--color-accent-strong)]"
                                      />
                                      <span className="text-ink">{value}</span>
                                    </label>
                                  ) : (
                                    <span className="text-ink-faint">—</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <details className="text-[12px] text-ink-soft">
                  <summary className="cursor-pointer font-semibold text-ink">Why these matched</summary>
                  <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                    {item.edges.map((edge) => (
                      <li key={`${edge.a}-${edge.b}`} className="tabular-nums">
                        <span className="font-mono font-bold text-ink">
                          {edge.a} ↔ {edge.b}
                        </span>{' '}
                        {pct(edge.score)} — name {pct(edge.parts.name ?? 0)}
                        {edge.parts.email !== undefined && `, email ${edge.parts.email ? 'same' : 'differs'}`}
                        {edge.parts.phone !== undefined && `, phone ${edge.parts.phone ? 'same' : 'differs'}`}
                        {edge.parts.address !== undefined && `, address ${pct(edge.parts.address)}`}
                      </li>
                    ))}
                  </ul>
                </details>

                <div className="flex flex-col gap-1 rounded-[var(--radius-tile)] bg-surface-sunken p-3">
                  <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Merged record</p>
                  <p className="m-0 text-[12px] text-ink">
                    {FIELDS.map((field) => (field === 'name' ? record.name : record[field]))
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const links = members.filter((member) => member.id !== survivor.id).map((member) => ({ from: member.id, to: survivor.id }))
                      const result = { record, mergedIds: links.map((link) => link.from), links }
                      update(item.key, { status: 'merged', result })
                      onMerge?.(result)
                      setMessage(`Merged ${members.length} records into ${survivor.id}.`)
                    }}
                  >
                    Merge {members.length} records
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      update(item.key, { status: 'rejected' })
                      onReject?.(item.ids)
                      setMessage(`Cluster ${index + 1} kept as separate records.`)
                    }}
                  >
                    Not duplicates
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-[12px] text-ink-soft">
                  {decision.status === 'merged' && decision.result
                    ? `${decision.result.record.name} (${decision.result.record.id}) · links ${decision.result.links.map((link) => `${link.from} → ${link.to}`).join(', ')}`
                    : `${item.ids.join(', ')} stay separate.`}
                </p>
                <Button size="sm" variant="ghost" onClick={() => update(item.key, { status: 'pending', result: undefined })}>
                  Undo
                </Button>
              </div>
            )}
          </section>
        )
      })}

      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
