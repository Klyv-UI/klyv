/**
 * A cron parser, describer and scheduler for CronEditor.
 *
 * Syntax is Vixie cron with the Quartz day extensions that most schedulers now
 * accept: five fields, or six with seconds first; lists, ranges and steps;
 * month and weekday names; L, W and # in the day fields; and the @daily
 * family of macros. Weekdays are 0–7 with both 0 and 7 meaning Sunday.
 *
 * Run times are found in wall-clock time in the chosen zone and only then
 * turned into instants, which is what makes DST come out right: a 02:30 job on
 * the night the clocks skip 02:00–03:00 is reported as moved, and a 01:30 job
 * on the night 01:00–02:00 repeats runs once (every-hour jobs run in both).
 */

export type CronEditorFieldName = 'second' | 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek'

export interface CronSpec {
  name: CronEditorFieldName
  label: string
  min: number
  max: number
  names?: string[]
}

export const CRON_SPECS: Record<CronEditorFieldName, CronSpec> = {
  second: { name: 'second', label: 'Second', min: 0, max: 59 },
  minute: { name: 'minute', label: 'Minute', min: 0, max: 59 },
  hour: { name: 'hour', label: 'Hour', min: 0, max: 23 },
  dayOfMonth: { name: 'dayOfMonth', label: 'Day of month', min: 1, max: 31 },
  month: { name: 'month', label: 'Month', min: 1, max: 12, names: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] },
  dayOfWeek: { name: 'dayOfWeek', label: 'Day of week', min: 0, max: 7, names: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] },
}

export const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
}

export interface CronEditorFieldError {
  field: CronEditorFieldName | 'expression'
  message: string
}

export interface CronField {
  text: string
  /** Written as * or ? — unrestricted, which matters for the day OR rule. */
  star: boolean
  values: Set<number>
  /** Day of month: L, L-n. */
  last: number[]
  /** Day of month: nW. */
  nearest: number[]
  /** Day of month: LW. */
  lastWeekday: boolean
  /** Day of week: nL. */
  lastDow: number[]
  /** Day of week: n#k. */
  nth: [number, number][]
}

export interface CronParsed {
  seconds: boolean
  fields: Record<CronEditorFieldName, CronField>
  /** The 5- or 6-field form, with macros expanded. */
  expanded: string
}

const ORDER5: CronEditorFieldName[] = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek']
const ORDER6: CronEditorFieldName[] = ['second', ...ORDER5]

function number(token: string, spec: CronSpec): number | string {
  const upper = token.toUpperCase()
  const named = spec.names?.indexOf(upper) ?? -1
  if (named >= 0) return named + (spec.name === 'month' ? 1 : 0)
  if (!/^\d+$/.test(token)) return `“${token}” is not a number${spec.names ? ` or a ${spec.name === 'month' ? 'month' : 'day'} name` : ''}`
  const n = Number(token)
  if (n < spec.min || n > spec.max) return `${n} is outside ${spec.min}–${spec.max}`
  return n
}

function parseField(text: string, spec: CronSpec): CronField | string {
  const field: CronField = { text, star: text === '*' || text === '?' || text.startsWith('*/'), values: new Set(), last: [], nearest: [], lastWeekday: false, lastDow: [], nth: [] }
  if (text === '') return 'Empty field'
  if (text === '?' && spec.name !== 'dayOfMonth' && spec.name !== 'dayOfWeek') return '“?” is only allowed in the day fields'
  for (const item of text.split(',')) {
    if (item === '') return 'Empty item in the list'
    const upper = item.toUpperCase()
    if (spec.name === 'dayOfMonth') {
      if (upper === 'LW') { field.lastWeekday = true; continue }
      const last = /^L(?:-(\d+))?$/.exec(upper)
      if (last) {
        const offset = Number(last[1] ?? 0)
        if (offset > 30) return `L-${offset} reaches before the first of the month`
        field.last.push(offset)
        continue
      }
      const w = /^(\d+)W$/.exec(upper)
      if (w) {
        const day = number(w[1], spec)
        if (typeof day === 'string') return day
        field.nearest.push(day)
        continue
      }
    }
    if (spec.name === 'dayOfWeek') {
      const lastDow = /^(\w+?)L$/.exec(upper)
      if (lastDow && upper !== 'L') {
        const day = number(lastDow[1], spec)
        if (typeof day === 'string') return day
        field.lastDow.push(day % 7)
        continue
      }
      const nth = /^(\w+)#(\d)$/.exec(upper)
      if (nth) {
        const day = number(nth[1], spec)
        if (typeof day === 'string') return day
        const k = Number(nth[2])
        if (k < 1 || k > 5) return `#${k}: there are at most five of a weekday in a month`
        field.nth.push([day % 7, k])
        continue
      }
      if (upper === 'L') { field.values.add(6); continue }
    }
    const match = /^(\*|\?|[\w]+)(?:-([\w]+))?(?:\/(\d+))?$/.exec(item)
    if (!match) return `Cannot read “${item}”`
    const [, startText, endText, stepText] = match
    let start: number
    let end: number
    if (startText === '*' || startText === '?') {
      if (endText) return `“${item}”: a range cannot start at *`
      start = spec.min
      end = spec.name === 'dayOfWeek' ? 6 : spec.max
    } else {
      const s = number(startText, spec)
      if (typeof s === 'string') return s
      start = s
      if (endText) {
        const e = number(endText, spec)
        if (typeof e === 'string') return e
        end = e
      } else end = stepText ? (spec.name === 'dayOfWeek' ? 6 : spec.max) : s
    }
    const step = stepText ? Number(stepText) : 1
    if (step < 1) return 'A step must be at least 1'
    if (step > spec.max - spec.min + 1) return `A step of ${step} never repeats in ${spec.min}–${spec.max}`
    if (end < start) {
      // Wrap-around ranges like FRI-MON or 22-2 are common intent; accept them.
      const size = spec.name === 'dayOfWeek' ? 7 : spec.max - spec.min + 1
      const span = (end - start + size) % size
      for (let travelled = 0; travelled <= span; travelled += step) {
        field.values.add(spec.min + ((start - spec.min + travelled) % size))
      }
    } else {
      for (let v = start; v <= end; v += step) field.values.add(v)
    }
  }
  if (spec.name === 'dayOfWeek' && field.values.has(7)) {
    field.values.delete(7)
    field.values.add(0)
  }
  return field
}

export function parseCron(expression: string): { ok: true; cron: CronParsed } | { ok: false; errors: CronEditorFieldError[] } {
  let text = expression.trim().replace(/\s+/g, ' ')
  if (!text) return { ok: false, errors: [{ field: 'expression', message: 'Enter a cron expression' }] }
  if (text.startsWith('@')) {
    const macro = MACROS[text.toLowerCase()]
    if (text.toLowerCase() === '@reboot') return { ok: false, errors: [{ field: 'expression', message: '@reboot runs at start-up, not on a schedule' }] }
    if (!macro) return { ok: false, errors: [{ field: 'expression', message: `Unknown macro ${text}` }] }
    text = macro
  }
  const parts = text.split(' ')
  if (parts.length !== 5 && parts.length !== 6) {
    return { ok: false, errors: [{ field: 'expression', message: `Found ${parts.length} fields; cron needs 5, or 6 with seconds first` }] }
  }
  const order = parts.length === 6 ? ORDER6 : ORDER5
  const errors: CronEditorFieldError[] = []
  const fields = {} as Record<CronEditorFieldName, CronField>
  order.forEach((name, index) => {
    const result = parseField(parts[index], CRON_SPECS[name])
    if (typeof result === 'string') errors.push({ field: name, message: result })
    else fields[name] = result
  })
  if (errors.length) return { ok: false, errors }
  if (!fields.second) fields.second = parseField('0', CRON_SPECS.second) as CronField
  return { ok: true, cron: { seconds: parts.length === 6, fields, expanded: text } }
}

/* ------------------------------------------------------------- matching */

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const weekday = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay()

function nearestWeekday(y: number, m: number, day: number): number {
  const max = daysIn(y, m)
  const d = Math.min(day, max)
  const w = weekday(y, m, d)
  if (w === 6) return d === 1 ? 3 : d - 1
  if (w === 0) return d === max ? d - 2 : d + 1
  return d
}

function domMatches(f: CronField, y: number, m: number, d: number) {
  if (f.values.has(d)) return true
  const max = daysIn(y, m)
  if (f.last.some((offset) => max - offset === d)) return true
  if (f.nearest.some((day) => nearestWeekday(y, m, day) === d)) return true
  if (f.lastWeekday) {
    let last = max
    while (weekday(y, m, last) === 0 || weekday(y, m, last) === 6) last--
    if (last === d) return true
  }
  return false
}

function dowMatches(f: CronField, y: number, m: number, d: number) {
  const w = weekday(y, m, d)
  if (f.values.has(w)) return true
  if (f.lastDow.includes(w) && d + 7 > daysIn(y, m)) return true
  return f.nth.some(([day, k]) => day === w && Math.ceil(d / 7) === k)
}

/** The day rule: when both day fields are restricted, either may match. */
export function dayMatches(cron: CronParsed, y: number, m: number, d: number) {
  const { dayOfMonth: dom, dayOfWeek: dow } = cron.fields
  if (dom.star && dow.star) return true
  if (dom.star) return dowMatches(dow, y, m, d)
  if (dow.star) return domMatches(dom, y, m, d)
  return domMatches(dom, y, m, d) || dowMatches(dow, y, m, d)
}

/* ---------------------------------------------------------- time zones */

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(zone: string) {
  let f = formatters.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    formatters.set(zone, f)
  }
  return f
}

export function isValidZone(zone: string) {
  try {
    formatter(zone)
    return true
  } catch {
    return false
  }
}

/** Wall-clock fields of an instant in a zone, as a UTC timestamp of those fields. */
function wallOf(instant: number, zone: string): number {
  const parts: Record<string, number> = {}
  for (const part of formatter(zone).formatToParts(new Date(instant))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second)
}

/** Zone offset in ms at an instant: wall time minus UTC. */
const offsetAt = (instant: number, zone: string) => wallOf(Math.floor(instant / 1000) * 1000, zone) - Math.floor(instant / 1000) * 1000

/** Every instant that shows this wall time in the zone: none in a gap, two in an overlap. */
function instantsFor(wall: number, zone: string): { instants: number[]; gapShift?: number } {
  const offsets = new Set([offsetAt(wall - 86_400_000, zone), offsetAt(wall, zone), offsetAt(wall + 86_400_000, zone)])
  const instants = [...offsets].map((o) => wall - o).filter((t) => wallOf(t, zone) === wall)
  if (instants.length) return { instants: [...new Set(instants)].sort((a, b) => a - b) }
  // In a gap: use the offset in force before the jump, which lands the run
  // the length of the gap later — the moment the clock reaches that time.
  const before = offsetAt(wall - 86_400_000, zone)
  const t = wall - before
  return { instants: [t], gapShift: wallOf(t, zone) - wall }
}

export interface CronEditorRun {
  /** The instant, in ms since the epoch. */
  at: number
  /** Why this run is unusual, when it is: a DST shift or a repeated hour. */
  note?: string
}

/**
 * The next `count` runs after `from`, in `zone`. Walks wall-clock fields,
 * jumping whole months, days and hours when they cannot match, and gives up
 * after eight years — enough for a 29 February schedule to show up twice.
 */
export function nextRuns(cron: CronParsed, zone: string, from: number, count: number): CronEditorRun[] {
  const f = cron.fields
  const startWall = wallOf(from, zone) + 1000
  const s = new Date(startWall)
  let y = s.getUTCFullYear()
  let mo = s.getUTCMonth() + 1
  let d = s.getUTCDate()
  let h = s.getUTCHours()
  let mi = s.getUTCMinutes()
  let se = s.getUTCSeconds()
  const limitYear = y + 8
  const runs: CronEditorRun[] = []
  const hourIsWild = f.hour.star
  let guard = 0
  let stopWall = Infinity
  let repeated = false

  const norm = () => {
    const t = new Date(Date.UTC(y, mo - 1, d, h, mi, se))
    y = t.getUTCFullYear()
    mo = t.getUTCMonth() + 1
    d = t.getUTCDate()
    h = t.getUTCHours()
    mi = t.getUTCMinutes()
    se = t.getUTCSeconds()
  }

  while (y <= limitYear && guard++ < 500_000) {
    if (!f.month.values.has(mo)) { mo += 1; d = 1; h = 0; mi = 0; se = 0; norm(); continue }
    if (!dayMatches(cron, y, mo, d)) { d += 1; h = 0; mi = 0; se = 0; norm(); continue }
    if (!f.hour.values.has(h)) { h += 1; mi = 0; se = 0; norm(); continue }
    if (!f.minute.values.has(mi)) { mi += 1; se = 0; norm(); continue }
    if (!f.second.values.has(se)) { se += 1; norm(); continue }

    const wall = Date.UTC(y, mo - 1, d, h, mi, se)
    if (wall > stopWall) break
    const { instants, gapShift } = instantsFor(wall, zone)
    const label = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
    if (gapShift) {
      runs.push({ at: instants[0], note: `${label} does not exist that day (clocks go forward), so it runs ${gapShift / 60000} minutes later` })
    } else if (instants.length > 1) {
      runs.push({ at: instants[0], note: `${label} happens twice that night (clocks go back)${hourIsWild ? '' : '; runs on the first'}` })
      if (hourIsWild) {
        runs.push({ at: instants[1], note: `${label} again, after the clocks go back` })
        repeated = true
      }
    } else runs.push({ at: instants[0] })
    // Past `count` runs we can stop — unless a repeated hour added second copies,
    // which are later instants than wall times still ahead of us.
    if (runs.length >= count && stopWall === Infinity) {
      if (!repeated) break
      stopWall = wall + 3 * 3_600_000
    }
    se += 1
    norm()
  }
  return runs
    .filter((run) => run.at > from)
    .sort((a, b) => a.at - b.at)
    .filter((run, index, all) => index === 0 || all[index - 1].at !== run.at)
    .slice(0, count)
}

/* ---------------------------------------------------------- description */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth']

const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)
const two = (n: number) => String(n).padStart(2, '0')
const suffix = (n: number) => (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th')

/** Sorted values folded into runs: [1,2,3,5] → ['1–3', '5']. */
function runsOf(values: number[], name: (n: number) => string, through = ' through ') {
  const out: string[] = []
  for (let i = 0; i < values.length; i++) {
    let j = i
    while (j + 1 < values.length && values[j + 1] === values[j] + 1) j++
    if (j - i >= 2) {
      out.push(`${name(values[i])}${through}${name(values[j])}`)
      i = j
    } else out.push(name(values[i]))
  }
  return list(out)
}

/** A step pattern if the field is exactly `*\/n` or `a-b/n`. */
function step(f: CronField): { n: number; from?: string } | null {
  const match = /^(\*|\d+(?:-\d+)?)\/(\d+)$/.exec(f.text)
  return match ? { n: Number(match[2]), from: match[1] === '*' ? undefined : match[1] } : null
}

function describeUnit(f: CronField, unit: string) {
  if (f.star && !step(f)) return `every ${unit}`
  const st = step(f)
  if (st) return `every ${st.n === 1 ? unit : `${st.n} ${unit}s`}${st.from ? ` from ${st.from.replace('-', ' to ')}` : ''}`
  const values = [...f.values].sort((a, b) => a - b)
  return `at ${unit}${values.length > 1 ? 's' : ''} ${runsOf(values, String)}`
}

export function describeCron(cron: CronParsed): string {
  const f = cron.fields
  const out: string[] = []
  const hours = [...f.hour.values].sort((a, b) => a - b)
  const minutes = [...f.minute.values].sort((a, b) => a - b)
  const second = [...f.second.values][0]
  const secondFixed = f.second.values.size === 1 && !f.second.star

  if (!f.hour.star && !f.minute.star && hours.length * minutes.length <= 4 && secondFixed) {
    const times = hours.flatMap((h) => minutes.map((m) => `${two(h)}:${two(m)}${second ? `:${two(second)}` : ''}`))
    out.push(`At ${list(times)}`)
  } else {
    const parts: string[] = []
    if (!(secondFixed && second === 0)) parts.push(describeUnit(f.second, 'second'))
    const minutePhrase = f.minute.values.size === 1 && !f.minute.star ? `at minute ${minutes[0]}` : describeUnit(f.minute, 'minute')
    if (!(parts.length && minutePhrase === 'every minute')) parts.push(minutePhrase)
    const st = step(f.hour)
    const contiguous = hours.length > 1 && hours.every((h, i) => i === 0 || h === hours[i - 1] + 1)
    if (f.hour.star && !st) {
      if (!parts[parts.length - 1].startsWith('every')) parts.push('past every hour')
    } else if (st && !st.from) parts.push(`every ${st.n} hours`)
    else if (contiguous) parts.push(`between ${two(hours[0])}:00 and ${two(hours[hours.length - 1])}:59`)
    else parts.push(`in the ${list(hours.map((h) => `${two(h)}:00`))} hour${hours.length > 1 ? 's' : ''}`)
    const sentence = parts.join(', ')
    out.push(sentence[0].toUpperCase() + sentence.slice(1))
  }

  const dom = f.dayOfMonth
  const dow = f.dayOfWeek
  const domText = () => {
    const bits: string[] = []
    const st = step(dom)
    if (st) bits.push(`every ${st.n} days of the month${st.from ? ` from day ${st.from}` : ''}`)
    else if (dom.values.size) bits.push(`on day ${runsOf([...dom.values].sort((a, b) => a - b), (n) => `${n}`)} of the month`)
    dom.last.forEach((o) => bits.push(o ? `${o} day${o > 1 ? 's' : ''} before the last day of the month` : 'on the last day of the month'))
    dom.nearest.forEach((n) => bits.push(`on the weekday nearest the ${n}${suffix(n)}`))
    if (dom.lastWeekday) bits.push('on the last weekday of the month')
    return list(bits)
  }
  const dowText = () => {
    const bits: string[] = []
    if (dow.values.size) bits.push(`on ${runsOf([...dow.values].sort((a, b) => a - b), (n) => DAYS[n])}`)
    dow.lastDow.forEach((d) => bits.push(`on the last ${DAYS[d]} of the month`))
    dow.nth.forEach(([d, k]) => bits.push(`on the ${ORDINAL[k]} ${DAYS[d]} of the month`))
    return list(bits)
  }
  if (!dom.star && !dow.star) out.push(`${domText()}, or ${dowText()}`)
  else if (!dom.star) out.push(domText())
  else if (!dow.star) out.push(dowText())

  if (!f.month.star || step(f.month)) {
    const st = step(f.month)
    out.push(st ? `every ${st.n} months` : `in ${runsOf([...f.month.values].sort((a, b) => a - b), (n) => MONTHS[n - 1])}`)
  }
  return `${out.join(', ')}.`
}
