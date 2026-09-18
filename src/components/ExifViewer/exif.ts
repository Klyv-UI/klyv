export type ExifViewerGroup = 'Camera' | 'Exposure' | 'Date' | 'Location' | 'Image'

export interface ExifViewerField {
  tag: number
  name: string
  group: ExifViewerGroup
  /** Readable value: units added, rationals divided, enums named. */
  value: string
  ifd: 'IFD0' | 'Exif' | 'GPS'
}

export interface ExifViewerSegment {
  marker: number
  name: string
  /** Offset of the 0xFF that starts the marker. */
  offset: number
  /** Whole segment length including the marker, in bytes. For SOS, everything to the end of the file. */
  length: number
}

export interface ExifViewerReport {
  segments: ExifViewerSegment[]
  byteOrder: 'Intel (little-endian)' | 'Motorola (big-endian)' | null
  fields: ExifViewerField[]
  gps: { latitude: number; longitude: number; altitude?: number } | null
  orientation: number | null
}

const SEGMENT_NAMES: Record<number, string> = {
  0xd8: 'SOI',
  0xe0: 'APP0 (JFIF)',
  0xe1: 'APP1 (EXIF / XMP)',
  0xe2: 'APP2 (ICC profile)',
  0xed: 'APP13 (IPTC)',
  0xee: 'APP14 (Adobe)',
  0xdb: 'DQT',
  0xc0: 'SOF0',
  0xc2: 'SOF2',
  0xc4: 'DHT',
  0xdd: 'DRI',
  0xda: 'SOS + image data',
  0xfe: 'COM',
}

/** Walk the marker segments up to and including the start of scan. */
export function exifViewerSegments(bytes: Uint8Array): ExifViewerSegment[] {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('This is not a JPEG: it does not start with the FFD8 marker.')
  const segments: ExifViewerSegment[] = [{ marker: 0xd8, name: 'SOI', offset: 0, length: 2 }]
  let at = 2
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) throw new Error(`Expected a marker at byte ${at}.`)
    while (bytes[at + 1] === 0xff) at += 1 // fill bytes
    const marker = bytes[at + 1]
    const name = SEGMENT_NAMES[marker] ?? (marker >= 0xe0 && marker <= 0xef ? `APP${marker - 0xe0}` : `0x${marker.toString(16).toUpperCase()}`)
    if (marker === 0xda) {
      segments.push({ marker, name, offset: at, length: bytes.length - at })
      return segments
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      segments.push({ marker, name, offset: at, length: 2 })
      at += 2
      continue
    }
    const length = (bytes[at + 2] << 8) | bytes[at + 3]
    if (length < 2 || at + 2 + length > bytes.length) throw new Error(`Segment ${name} at byte ${at} runs past the end of the file.`)
    segments.push({ marker, name, offset: at, length: length + 2 })
    at += 2 + length
  }
  throw new Error('The JPEG ends before its image data starts.')
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

const TAGS: Record<'IFD0' | 'Exif' | 'GPS', Record<number, [string, ExifViewerGroup]>> = {
  IFD0: {
    0x010f: ['Make', 'Camera'],
    0x0110: ['Model', 'Camera'],
    0x0112: ['Orientation', 'Image'],
    0x011a: ['X resolution', 'Image'],
    0x011b: ['Y resolution', 'Image'],
    0x0131: ['Software', 'Camera'],
    0x0132: ['Modified', 'Date'],
    0x013b: ['Artist', 'Camera'],
    0x8298: ['Copyright', 'Camera'],
  },
  Exif: {
    0x829a: ['Exposure time', 'Exposure'],
    0x829d: ['Aperture', 'Exposure'],
    0x8822: ['Program', 'Exposure'],
    0x8827: ['ISO', 'Exposure'],
    0x9003: ['Taken', 'Date'],
    0x9004: ['Digitised', 'Date'],
    0x9204: ['Exposure bias', 'Exposure'],
    0x9209: ['Flash', 'Exposure'],
    0x920a: ['Focal length', 'Camera'],
    0xa002: ['Pixel width', 'Image'],
    0xa003: ['Pixel height', 'Image'],
    0xa405: ['Focal length (35 mm)', 'Camera'],
    0xa433: ['Lens make', 'Camera'],
    0xa434: ['Lens', 'Camera'],
  },
  GPS: {
    0x0001: ['Latitude ref', 'Location'],
    0x0002: ['Latitude', 'Location'],
    0x0003: ['Longitude ref', 'Location'],
    0x0004: ['Longitude', 'Location'],
    0x0005: ['Altitude ref', 'Location'],
    0x0006: ['Altitude', 'Location'],
  },
}

const ORIENTATION = ['', 'Normal', 'Mirrored', 'Rotated 180°', 'Flipped vertically', 'Mirrored, rotated 90° CCW', 'Rotated 90° CW', 'Mirrored, rotated 90° CW', 'Rotated 90° CCW']
const PROGRAM = ['Not defined', 'Manual', 'Program', 'Aperture priority', 'Shutter priority', 'Creative', 'Action', 'Portrait', 'Landscape']

type Raw = number | string | number[]

/**
 * Read an EXIF block: the TIFF header (either byte order), IFD0, and the Exif
 * and GPS sub-IFDs it points to. Values of every standard type are decoded —
 * rationals divided, ASCII trimmed — and the common tags are named, grouped
 * and given units. A JPEG with no EXIF returns an empty report, not an error.
 */
export function exifViewerParse(bytes: Uint8Array): ExifViewerReport {
  const segments = exifViewerSegments(bytes)
  const report: ExifViewerReport = { segments, byteOrder: null, fields: [], gps: null, orientation: null }
  const app1 = segments.find(
    (segment) => segment.marker === 0xe1 && String.fromCharCode(...bytes.subarray(segment.offset + 4, segment.offset + 10)) === 'Exif\0\0',
  )
  if (!app1) return report

  const tiff = app1.offset + 10
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const order = String.fromCharCode(bytes[tiff], bytes[tiff + 1])
  if (order !== 'II' && order !== 'MM') throw new Error('The EXIF block has no valid byte-order mark.')
  const little = order === 'II'
  report.byteOrder = little ? 'Intel (little-endian)' : 'Motorola (big-endian)'
  const u16 = (at: number) => view.getUint16(at, little)
  const u32 = (at: number) => view.getUint32(at, little)
  if (u16(tiff + 2) !== 42) throw new Error('The TIFF header inside the EXIF block is not valid.')
  const end = app1.offset + app1.length

  const readValue = (type: number, count: number, at: number): Raw => {
    if (type === 2) return String.fromCharCode(...bytes.subarray(at, at + count)).replace(/\0+$/, '').trim()
    const values: number[] = []
    for (let index = 0; index < Math.min(count, 64); index += 1) {
      const offset = at + index * TYPE_SIZE[type]
      if (type === 1 || type === 7) values.push(bytes[offset])
      else if (type === 3) values.push(u16(offset))
      else if (type === 4) values.push(u32(offset))
      else if (type === 9) values.push(view.getInt32(offset, little))
      else if (type === 5) values.push(u32(offset) / (u32(offset + 4) || 1))
      else if (type === 10) values.push(view.getInt32(offset, little) / (view.getInt32(offset + 4, little) || 1))
    }
    return values.length === 1 ? values[0] : values
  }

  const readIfd = (offset: number, ifd: 'IFD0' | 'Exif' | 'GPS', visited: Set<number>) => {
    const start = tiff + offset
    if (visited.has(start) || start + 2 > end) return new Map<number, Raw>()
    visited.add(start)
    const entries = new Map<number, Raw>()
    const count = u16(start)
    for (let index = 0; index < count; index += 1) {
      const entry = start + 2 + index * 12
      if (entry + 12 > end) break
      const tag = u16(entry)
      const type = u16(entry + 2)
      const n = u32(entry + 4)
      if (!TYPE_SIZE[type]) continue
      const size = TYPE_SIZE[type] * n
      const at = size <= 4 ? entry + 8 : tiff + u32(entry + 8)
      if (at + size > end) continue
      entries.set(tag, readValue(type, n, at))
    }
    for (const [tag, raw] of entries) {
      const known = TAGS[ifd][tag]
      if (known) report.fields.push({ tag, name: known[0], group: known[1], value: describe(tag, ifd, raw), ifd })
    }
    return entries
  }

  const visited = new Set<number>()
  const ifd0 = readIfd(u32(tiff + 4), 'IFD0', visited)
  const exifPointer = ifd0.get(0x8769)
  if (typeof exifPointer === 'number') readIfd(exifPointer, 'Exif', visited)
  const gpsPointer = ifd0.get(0x8825)
  if (typeof gpsPointer === 'number') {
    const gps = readIfd(gpsPointer, 'GPS', visited)
    const lat = gps.get(0x0002)
    const lon = gps.get(0x0004)
    if (Array.isArray(lat) && Array.isArray(lon)) {
      const decimal = ([d, m, s]: number[], ref: Raw | undefined, negative: string) => (d + (m ?? 0) / 60 + (s ?? 0) / 3600) * (ref === negative ? -1 : 1)
      const altitude = gps.get(0x0006)
      report.gps = {
        latitude: decimal(lat, gps.get(0x0001), 'S'),
        longitude: decimal(lon, gps.get(0x0003), 'W'),
        altitude: typeof altitude === 'number' ? altitude * (gps.get(0x0005) === 1 ? -1 : 1) : undefined,
      }
    }
  }
  const orientation = ifd0.get(0x0112)
  report.orientation = typeof orientation === 'number' ? orientation : null
  return report
}

function describe(tag: number, ifd: string, raw: Raw): string {
  const n = typeof raw === 'number' ? raw : NaN
  if (ifd === 'GPS' && Array.isArray(raw) && raw.length === 3) return `${raw[0]}° ${raw[1]}′ ${raw[2].toFixed(2)}″`
  if (ifd === 'GPS' && tag === 0x0006) return `${n.toFixed(1)} m`
  if (ifd === 'GPS' && tag === 0x0005) return n === 1 ? 'Below sea level' : 'Above sea level'
  if (ifd !== 'Exif' && tag === 0x0112) return ORIENTATION[n] ?? `Unknown (${n})`
  if (ifd === 'Exif') {
    if (tag === 0x829a) return n >= 1 ? `${n} s` : `1/${Math.round(1 / n)} s`
    if (tag === 0x829d) return `f/${n.toFixed(1)}`
    if (tag === 0x920a) return `${n.toFixed(n % 1 ? 1 : 0)} mm`
    if (tag === 0xa405) return `${n} mm`
    if (tag === 0x9204) return `${n > 0 ? '+' : ''}${n.toFixed(1)} EV`
    if (tag === 0x8822) return PROGRAM[n] ?? `Unknown (${n})`
    if (tag === 0x9209) return n & 1 ? 'Fired' : 'Did not fire'
  }
  if (typeof raw === 'string') return /^\d{4}:\d\d:\d\d \d\d:\d\d:\d\d$/.test(raw) ? raw.replace(/^(\d{4}):(\d\d):(\d\d)/, '$1-$2-$3') : raw
  if (Array.isArray(raw)) return raw.join(', ')
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/**
 * The same JPEG with its APP1 (EXIF, XMP) and APP13 (IPTC) segments removed.
 * Nothing is decoded or re-encoded: every other segment and the compressed
 * image data are copied byte for byte, so the picture is unchanged.
 */
export function exifViewerStrip(bytes: Uint8Array): Uint8Array {
  const kept = exifViewerSegments(bytes).filter((segment) => segment.marker !== 0xe1 && segment.marker !== 0xed)
  const out = new Uint8Array(kept.reduce((sum, segment) => sum + segment.length, 0))
  let at = 0
  for (const segment of kept) {
    out.set(bytes.subarray(segment.offset, segment.offset + segment.length), at)
    at += segment.length
  }
  return out
}

/** Check a stripped file: no metadata segments left, and every kept segment — image data included — identical. */
export function exifViewerVerify(original: Uint8Array, stripped: Uint8Array): { ok: boolean; message: string } {
  const before = exifViewerSegments(original).filter((segment) => segment.marker !== 0xe1 && segment.marker !== 0xed)
  const after = exifViewerSegments(stripped)
  if (after.some((segment) => segment.marker === 0xe1 || segment.marker === 0xed)) return { ok: false, message: 'Metadata segments are still present.' }
  if (before.length !== after.length) return { ok: false, message: 'The segment list changed.' }
  for (let index = 0; index < before.length; index += 1) {
    const a = original.subarray(before[index].offset, before[index].offset + before[index].length)
    const b = stripped.subarray(after[index].offset, after[index].offset + after[index].length)
    if (a.length !== b.length || a.some((byte, at) => byte !== b[at])) return { ok: false, message: `${after[index].name} differs from the original.` }
  }
  return { ok: true, message: 'No EXIF, XMP or IPTC left; image data identical byte for byte.' }
}
