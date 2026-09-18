/** One entry of a ZIP’s central directory. */
export interface ZipBrowserEntry {
  /** Full path inside the archive, with forward slashes. */
  name: string
  directory: boolean
  /** 0 stored, 8 deflate; anything else cannot be extracted here. */
  method: number
  compressedSize: number
  size: number
  crc32: number
  /** The name was stored as UTF-8 (general-purpose flag bit 11); otherwise it is code page 437. */
  utf8: boolean
  encrypted: boolean
  /** Sizes or offset came from a ZIP64 extra field. */
  zip64: boolean
  localOffset: number
  modified: Date
}

// Code page 437, upper half — the encoding ZIP names use when the UTF-8 flag is not set.
const CP437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ '
const cp437 = (bytes: Uint8Array) => Array.from(bytes, (byte) => (byte < 128 ? String.fromCharCode(byte) : CP437[byte - 128])).join('')

let table: Uint32Array | null = null
/** CRC-32 (IEEE 802.3, the polynomial ZIP uses), table-driven. */
export function zipBrowserCrc32(bytes: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256)
    for (let n = 0; n < 256; n += 1) {
      let c = n
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index += 1) crc = table[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const u64 = (view: DataView, at: number) => view.getUint32(at, true) + view.getUint32(at + 4, true) * 2 ** 32

/**
 * Read the central directory. It lives at the end of the file, so the End of
 * Central Directory record is found by scanning back from the end (past a
 * comment of up to 64 KB); ZIP64 archives are followed through the locator to
 * their 64-bit record. Local headers are not trusted for sizes — streamed
 * archives leave them zero — which is why everything comes from here.
 */
export function zipBrowserRead(bytes: Uint8Array): ZipBrowserEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 65535); at -= 1) {
    if (view.getUint32(at, true) === 0x06054b50) {
      eocd = at
      break
    }
  }
  if (eocd < 0) throw new Error('This is not a ZIP archive: no end-of-central-directory record was found.')
  let count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  if ((count === 0xffff || offset === 0xffffffff) && eocd >= 20 && view.getUint32(eocd - 20, true) === 0x07064b50) {
    const record = u64(view, eocd - 12)
    if (view.getUint32(record, true) !== 0x06064b50) throw new Error('The ZIP64 end-of-central-directory record is missing.')
    count = u64(view, record + 32)
    offset = u64(view, record + 48)
  }

  const entries: ZipBrowserEntry[] = []
  let at = offset
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw new Error(`Central directory entry ${index + 1} is damaged.`)
    const flags = view.getUint16(at + 8, true)
    const time = view.getUint16(at + 12, true)
    const date = view.getUint16(at + 14, true)
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    const rawName = bytes.subarray(at + 46, at + 46 + nameLength)
    const utf8 = Boolean(flags & 0x800)
    const name = utf8 ? new TextDecoder().decode(rawName) : cp437(rawName)
    let size = view.getUint32(at + 24, true)
    let compressedSize = view.getUint32(at + 20, true)
    let localOffset = view.getUint32(at + 42, true)
    let zip64 = false
    // ZIP64 extra field: only the values that overflowed are present, in this order.
    for (let extra = at + 46 + nameLength; extra + 4 <= at + 46 + nameLength + extraLength; ) {
      const id = view.getUint16(extra, true)
      const length = view.getUint16(extra + 2, true)
      if (id === 0x0001) {
        let field = extra + 4
        if (size === 0xffffffff) {
          size = u64(view, field)
          field += 8
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = u64(view, field)
          field += 8
        }
        if (localOffset === 0xffffffff) localOffset = u64(view, field)
        zip64 = true
      }
      extra += 4 + length
    }
    entries.push({
      name,
      directory: name.endsWith('/'),
      method: view.getUint16(at + 10, true),
      compressedSize,
      size,
      crc32: view.getUint32(at + 16, true),
      utf8,
      encrypted: Boolean(flags & 1),
      zip64,
      localOffset,
      modified: new Date(1980 + (date >> 9), ((date >> 5) & 15) - 1, date & 31, time >> 11, (time >> 5) & 63, (time & 31) * 2),
    })
    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/**
 * One entry’s contents: stored entries are sliced out, deflated ones are
 * inflated with the browser’s own DecompressionStream. The CRC-32 is checked
 * against the central directory either way.
 */
export async function zipBrowserExtract(bytes: Uint8Array, entry: ZipBrowserEntry): Promise<{ data: Uint8Array; crcOk: boolean }> {
  if (entry.encrypted) throw new Error('This entry is encrypted.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(entry.localOffset, true) !== 0x04034b50) throw new Error('The local header for this entry is missing.')
  const start = entry.localOffset + 30 + view.getUint16(entry.localOffset + 26, true) + view.getUint16(entry.localOffset + 28, true)
  const raw = bytes.subarray(start, start + entry.compressedSize)
  let data: Uint8Array
  if (entry.method === 0) data = raw.slice()
  else if (entry.method === 8) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot inflate deflated entries (no DecompressionStream).')
    const stream = new ReadableStream<BufferSource>({
      start(controller) {
        controller.enqueue(raw as BufferSource)
        controller.close()
      },
    }).pipeThrough(new DecompressionStream('deflate-raw'))
    data = new Uint8Array(await new Response(stream).arrayBuffer())
  } else throw new Error(`Compression method ${entry.method} is not supported; only stored and deflate are.`)
  return { data, crcOk: zipBrowserCrc32(data) === entry.crc32 }
}
