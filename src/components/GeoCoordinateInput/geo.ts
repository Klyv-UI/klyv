/**
 * Coordinate parsing and spherical geometry for GeoCoordinateInput.
 *
 * The parser is forgiving about notation and strict about meaning: it accepts
 * decimal degrees, degrees-minutes-seconds and degrees-decimal-minutes, with a
 * sign or a hemisphere letter before or after, and then refuses anything that
 * is out of range or says the same thing twice (a minus sign *and* an S).
 */

export interface GeoCoordinateInputPoint {
  /** Latitude in decimal degrees, −90 to 90. */
  lat: number
  /** Longitude in decimal degrees, −180 to 180. */
  lon: number
}

export type GeoCoordinateInputParse =
  | { ok: true; point: GeoCoordinateInputPoint; notation: 'decimal' | 'dms' | 'ddm' }
  | { ok: false; error: string }

type Unit = 'd' | 'm' | 's'
type Hemi = 'N' | 'S' | 'E' | 'W'

interface Num {
  v: number
  neg: boolean
  unit?: Unit
}

type Token = { t: 'num'; num: Num } | { t: 'hemi'; h: Hemi } | { t: 'sep' }

interface Part {
  hemi?: Hemi
  nums: Num[]
}

function tokenize(input: string): Token[] | string {
  let text = input
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/[º˚]/g, '°')
    .replace(/(?:''|”|“|")/g, '″')
    .replace(/[’‘'`´]/g, '′')
    // Lower-case letters after a number are units: 51d 30m 26s. Upper-case S is south.
    .replace(/(\d)\s*d(?![a-z])/g, '$1°')
    .replace(/(\d)\s*m(?![a-z])/g, '$1′')
    .replace(/(\d)\s*s(?![a-z])/g, '$1″')
  // A comma is a decimal point only when nothing else could be: no full stops,
  // and the halves are split by a semicolon or by space ("51,5; -0,12").
  if (!text.includes('.') && /\d,\d/.test(text) && (text.includes(';') || /\d,\d+\S*\s+\S*\d,\d/.test(text))) {
    text = text.replace(/(\d),(\d)/g, '$1.$2')
  }
  const tokens: Token[] = []
  const re = /\s*(?:([+-]?\d+(?:\.\d+)?)|([°′″])|(north|south|east|west|[NSEW])(?![a-z])|([,;/]))/iy
  let index = 0
  while (index < text.length) {
    re.lastIndex = index
    const match = re.exec(text)
    if (!match) {
      const rest = text.slice(index)
      if (!rest.trim()) break
      return `Unexpected “${rest.trim()[0]}” at character ${index + rest.length - rest.trimStart().length + 1}`
    }
    index = re.lastIndex
    if (match[1] !== undefined) {
      tokens.push({ t: 'num', num: { v: Math.abs(Number(match[1])), neg: match[1].startsWith('-') } })
    } else if (match[2]) {
      const last = tokens[tokens.length - 1]
      if (!last || last.t !== 'num' || last.num.unit) return `“${match[2]}” needs a number before it`
      last.num.unit = match[2] === '°' ? 'd' : match[2] === '′' ? 'm' : 's'
    } else if (match[3]) tokens.push({ t: 'hemi', h: match[3][0].toUpperCase() as Hemi })
    else tokens.push({ t: 'sep' })
  }
  return tokens
}

/** Split the token stream into the two halves of the pair. */
function split(tokens: Token[]): Part[] | string {
  const parts: Part[] = []
  let current: Part = { nums: [] }
  const close = () => {
    if (current.nums.length || current.hemi) parts.push(current)
    current = { nums: [] }
  }
  const hemis = tokens.filter((token) => token.t === 'hemi').length
  if (hemis) {
    // Letters decide the split: before the numbers (N 51 30) or after (51 30 N).
    const prefix = tokens[0].t === 'hemi'
    for (const token of tokens) {
      if (token.t === 'num') current.nums.push(token.num)
      else if (token.t === 'hemi') {
        if (prefix) {
          close()
          current.hemi = token.h
        } else {
          if (!current.nums.length) return `“${token.h}” has no number before it`
          current.hemi = token.h
          close()
        }
      }
    }
    close()
    return parts
  }
  if (tokens.some((token) => token.t === 'sep')) {
    for (const token of tokens) {
      if (token.t === 'num') current.nums.push(token.num)
      else close()
    }
    close()
    return parts
  }
  // No letters, no separators: a new degrees mark or a new sign starts the
  // second half ("51°30′ -0°7′"), otherwise 2 numbers are decimal, 4 are
  // degrees and minutes, 6 are degrees, minutes and seconds.
  for (const token of tokens) {
    if (token.t !== 'num') continue
    if (current.nums.length && (token.num.unit === 'd' || token.num.neg)) close()
    current.nums.push(token.num)
  }
  close()
  if (parts.length === 1) {
    const nums = parts[0].nums
    if (nums.length % 2 === 0 && nums.length <= 6 && nums.every((n) => !n.unit)) {
      const half = nums.length / 2
      return [{ nums: nums.slice(0, half) }, { nums: nums.slice(half) }]
    }
  }
  return parts
}

function value(part: Part, which: string): { v: number; places: number } | string {
  if (part.nums.length === 0) return `The ${which} has a hemisphere but no number`
  if (part.nums.length > 3) return `The ${which} has more numbers than degrees, minutes and seconds`
  const order: Unit[] = ['d', 'm', 's']
  let total = 0
  let negative = false
  part.nums.forEach((num, index) => {
    if (!num.unit) num.unit = order[index]
  })
  const units = part.nums.map((num) => num.unit!)
  if (new Set(units).size !== units.length) return `The ${which} repeats a unit`
  for (let index = 0; index < part.nums.length; index++) {
    const num = part.nums[index]
    if (num.unit !== order[index]) return `The ${which} gives ${units.join(', ')}; expected degrees, then minutes, then seconds`
    if (index > 0 && num.neg) return `Only the degrees of the ${which} may carry a sign`
    if (index < part.nums.length - 1 && !Number.isInteger(num.v)) return `Only the last number of the ${which} may have a fraction`
    if (index > 0 && num.v >= 60) return `${num.unit === 'm' ? 'Minutes' : 'Seconds'} of the ${which} must be below 60`
    if (index === 0) negative = num.neg
    total += num.v / 60 ** index
  }
  if (negative && (part.hemi === 'S' || part.hemi === 'W' || part.hemi === 'N' || part.hemi === 'E')) {
    return `The ${which} has both a minus sign and “${part.hemi}”; use one`
  }
  const sign = negative || part.hemi === 'S' || part.hemi === 'W' ? -1 : 1
  return { v: sign * total, places: part.nums.length }
}

/** Read a latitude/longitude pair written in any common notation. */
export function parseCoordinate(input: string): GeoCoordinateInputParse {
  if (!input.trim()) return { ok: false, error: 'Enter a latitude and a longitude' }
  const tokens = tokenize(input)
  if (typeof tokens === 'string') return { ok: false, error: tokens }
  const parts = split(tokens)
  if (typeof parts === 'string') return { ok: false, error: parts }
  if (parts.length < 2) return { ok: false, error: 'Only one coordinate found; add the longitude' }
  if (parts.length > 2) return { ok: false, error: 'More than two coordinates found' }

  let [latPart, lonPart] = parts
  const isLon = (part: Part) => part.hemi === 'E' || part.hemi === 'W'
  const isLat = (part: Part) => part.hemi === 'N' || part.hemi === 'S'
  if (isLon(latPart) || isLat(lonPart)) [latPart, lonPart] = [lonPart, latPart]
  if ((latPart.hemi && !isLat(latPart)) || (lonPart.hemi && !isLon(lonPart))) {
    return { ok: false, error: 'Both halves name the same axis; one needs N or S and the other E or W' }
  }
  const lat = value(latPart, 'latitude')
  if (typeof lat === 'string') return { ok: false, error: lat }
  const lon = value(lonPart, 'longitude')
  if (typeof lon === 'string') return { ok: false, error: lon }
  if (Math.abs(lat.v) > 90) {
    const swapped = !latPart.hemi && Math.abs(lon.v) <= 90 && Math.abs(lat.v) <= 180
    return { ok: false, error: `Latitude ${lat.v.toFixed(4)} is outside ±90${swapped ? '. Did you write longitude first? Latitude comes first' : ''}` }
  }
  if (Math.abs(lon.v) > 180) return { ok: false, error: `Longitude ${lon.v.toFixed(4)} is outside ±180` }
  const places = Math.max(lat.places, lon.places)
  return { ok: true, point: { lat: lat.v, lon: lon.v === -0 ? 0 : lon.v }, notation: places === 3 ? 'dms' : places === 2 ? 'ddm' : 'decimal' }
}

/* ------------------------------------------------------------ formatting */

const pad = (n: number, width: number) => String(n).padStart(width, '0')

function dms(v: number, pos: string, neg: string, degWidth: number, decimals: number) {
  const abs = Math.abs(v)
  let d = Math.floor(abs)
  let m = Math.floor((abs - d) * 60)
  let s = Number(((abs - d - m / 60) * 3600).toFixed(decimals))
  if (s >= 60) (s = 0), (m += 1)
  if (m >= 60) (m = 0), (d += 1)
  const sText = decimals ? s.toFixed(decimals).padStart(decimals + 3, '0') : pad(s, 2)
  return `${pad(d, degWidth)}°${pad(m, 2)}′${sText}″${v < 0 ? neg : pos}`
}

function ddm(v: number, pos: string, neg: string, degWidth: number, decimals: number) {
  const abs = Math.abs(v)
  let d = Math.floor(abs)
  let m = Number(((abs - d) * 60).toFixed(decimals))
  if (m >= 60) (m = 0), (d += 1)
  return `${pad(d, degWidth)}°${m.toFixed(decimals).padStart(decimals + 3, '0')}′${v < 0 ? neg : pos}`
}

export type GeoCoordinateInputFormat = 'decimal' | 'dms' | 'ddm' | 'geo-uri'

/** Write a point in one of the copyable notations. */
export function formatCoordinate(point: GeoCoordinateInputPoint, format: GeoCoordinateInputFormat, precision = 6): string {
  const { lat, lon } = point
  if (format === 'dms') return `${dms(lat, 'N', 'S', 2, 1)} ${dms(lon, 'E', 'W', 3, 1)}`
  if (format === 'ddm') return `${ddm(lat, 'N', 'S', 2, 3)} ${ddm(lon, 'E', 'W', 3, 3)}`
  const fixed = (n: number) => Number(n.toFixed(precision)).toString()
  if (format === 'geo-uri') return `geo:${fixed(lat)},${fixed(lon)}`
  return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`
}

/** The point in words, for the read-back line. */
export function readBack(point: GeoCoordinateInputPoint): string {
  const words = (v: number, pos: string, neg: string) => {
    const abs = Math.abs(v)
    const d = Math.floor(abs)
    const m = Math.floor((abs - d) * 60)
    const s = Math.round((abs - d - m / 60) * 3600)
    return `${d} degrees ${m} minutes ${s} seconds ${v < 0 ? neg : pos}`
  }
  return `${words(point.lat, 'north', 'south')}, ${words(point.lon, 'east', 'west')}`
}

/* -------------------------------------------------------------- geometry */

/** Mean Earth radius in kilometres (IUGG). */
const EARTH_KM = 6371.0088
const rad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance by the haversine formula, in kilometres. */
export function haversineKm(a: GeoCoordinateInputPoint, b: GeoCoordinateInputPoint): number {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Initial bearing from `a` towards `b`, in degrees clockwise from true north. */
export function initialBearing(a: GeoCoordinateInputPoint, b: GeoCoordinateInputPoint): number {
  const φ1 = rad(a.lat)
  const φ2 = rad(b.lat)
  const Δλ = rad(b.lon - a.lon)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

const WINDS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

/** The 16-wind compass point for a bearing. */
export function compassPoint(bearing: number): string {
  return WINDS[Math.round(bearing / 22.5) % 16]
}
