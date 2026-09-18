/** One captured frame: RGBA pixels and how long it shows. */
export interface GifRecorderFrame {
  data: Uint8ClampedArray
  width: number
  height: number
  /** Milliseconds this frame stays on screen. GIF stores hundredths of a second. */
  delay: number
}

export interface GifRecorderEncodeOptions {
  /** One 256-colour table for the whole animation, or one per frame. */
  palette?: 'global' | 'local'
  /** Floyd–Steinberg error diffusion, which trades banding for fine grain. */
  dither?: boolean
  /** Loop forever. Off plays once. */
  loop?: boolean
}

type Palette = Uint8Array // 256 × RGB

/** Median cut to 256 colours over packed RGB samples; unused slots are black. */
function quantize(samples: Uint8Array): Palette {
  const indices = new Uint32Array(samples.length / 3)
  for (let index = 0; index < indices.length; index += 1) indices[index] = index
  const boxes: Uint32Array[] = indices.length ? [indices] : []
  const spread = (box: Uint32Array) => {
    const low = [255, 255, 255]
    const high = [0, 0, 0]
    for (const index of box)
      for (let c = 0; c < 3; c += 1) {
        const value = samples[index * 3 + c]
        if (value < low[c]) low[c] = value
        if (value > high[c]) high[c] = value
      }
    const ranges = high.map((value, c) => value - low[c])
    const channel = ranges.indexOf(Math.max(...ranges))
    return { channel, range: ranges[channel] }
  }
  const described = boxes.map((box) => ({ box, ...spread(box) }))
  while (described.length < 256) {
    let pick = -1
    let best = 0
    described.forEach((entry, index) => {
      const priority = entry.range * Math.sqrt(entry.box.length)
      if (entry.box.length > 1 && entry.range > 0 && priority > best) {
        best = priority
        pick = index
      }
    })
    if (pick < 0) break
    const { box, channel } = described[pick]
    const sorted = Uint32Array.from(box).sort((a, b) => samples[a * 3 + channel] - samples[b * 3 + channel])
    // Split at the median, moved to where the channel value changes, so a run of one colour stays whole.
    let middle = sorted.length >> 1
    const at = (index: number) => samples[sorted[index] * 3 + channel]
    let low = middle
    while (low > 0 && at(low - 1) === at(middle)) low -= 1
    let high = middle
    while (high < sorted.length && at(high) === at(middle)) high += 1
    middle = low > 0 && (middle - low <= high - middle || high >= sorted.length) ? low : high < sorted.length ? high : middle
    const left = sorted.slice(0, middle)
    const right = sorted.slice(middle)
    described.splice(pick, 1, { box: left, ...spread(left) }, { box: right, ...spread(right) })
  }
  const palette = new Uint8Array(256 * 3)
  described.forEach(({ box }, slot) => {
    const sum = [0, 0, 0]
    for (const index of box) for (let c = 0; c < 3; c += 1) sum[c] += samples[index * 3 + c]
    for (let c = 0; c < 3; c += 1) palette[slot * 3 + c] = Math.round(sum[c] / box.length)
  })
  return palette
}

/** Nearest palette entry, memoised on a 15-bit colour key so each distinct colour is searched once. */
function nearest(palette: Palette) {
  const cache = new Int16Array(32768).fill(-1)
  return (r: number, g: number, b: number) => {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    let hit = cache[key]
    if (hit < 0) {
      let best = Infinity
      for (let slot = 0; slot < 256; slot += 1) {
        const distance = (r - palette[slot * 3]) ** 2 + (g - palette[slot * 3 + 1]) ** 2 + (b - palette[slot * 3 + 2]) ** 2
        if (distance < best) {
          best = distance
          hit = slot
        }
      }
      cache[key] = hit
    }
    return hit
  }
}

function indexFrame(frame: GifRecorderFrame, palette: Palette, dither: boolean): Uint8Array {
  const { width, height, data } = frame
  const lookup = nearest(palette)
  const out = new Uint8Array(width * height)
  if (!dither) {
    for (let index = 0; index < out.length; index += 1) out[index] = lookup(data[index * 4], data[index * 4 + 1], data[index * 4 + 2])
    return out
  }
  const work = new Float32Array(width * height * 3)
  for (let index = 0; index < out.length; index += 1) for (let c = 0; c < 3; c += 1) work[index * 3 + c] = data[index * 4 + c]
  const spill = (x: number, y: number, error: number[], weight: number) => {
    if (x < 0 || x >= width || y >= height) return
    const at = (y * width + x) * 3
    for (let c = 0; c < 3; c += 1) work[at + c] += error[c] * weight
  }
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const rgb = [0, 1, 2].map((c) => Math.min(255, Math.max(0, work[index * 3 + c])))
      const slot = lookup(rgb[0], rgb[1], rgb[2])
      out[index] = slot
      const error = rgb.map((value, c) => value - palette[slot * 3 + c])
      spill(x + 1, y, error, 7 / 16)
      spill(x - 1, y + 1, error, 3 / 16)
      spill(x, y + 1, error, 5 / 16)
      spill(x + 1, y + 1, error, 1 / 16)
    }
  return out
}

/**
 * GIF’s variable-width LZW. Codes start one bit wider than the 8-bit pixels,
 * widen each time the table outgrows them, and the table is cleared and
 * restarted when it reaches 4096 entries, which is the format’s limit.
 */
export function gifRecorderLzw(indices: Uint8Array, minCodeSize = 8): Uint8Array {
  const clear = 1 << minCodeSize
  const end = clear + 1
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  let size = minCodeSize + 1
  let next = end + 1
  let table = new Map<number, number>()
  const emit = (code: number) => {
    buffer |= code << bits
    bits += size
    while (bits >= 8) {
      bytes.push(buffer & 0xff)
      buffer >>>= 8
      bits -= 8
    }
  }
  emit(clear)
  let prefix = indices[0] ?? 0
  for (let index = 1; index < indices.length; index += 1) {
    const pixel = indices[index]
    const key = (prefix << 8) | pixel
    const found = table.get(key)
    if (found !== undefined) {
      prefix = found
      continue
    }
    emit(prefix)
    if (next === 4096) {
      emit(clear)
      table = new Map()
      next = end + 1
      size = minCodeSize + 1
    } else {
      if (next >= 1 << size) size += 1
      table.set(key, next)
      next += 1
    }
    prefix = pixel
  }
  emit(prefix)
  emit(end)
  if (bits > 0) bytes.push(buffer & 0xff)
  return Uint8Array.from(bytes)
}

class Writer {
  bytes: number[] = []
  byte(value: number) {
    this.bytes.push(value & 0xff)
  }
  short(value: number) {
    this.byte(value)
    this.byte(value >> 8)
  }
  text(value: string) {
    for (const character of value) this.byte(character.charCodeAt(0))
  }
  all(values: ArrayLike<number>) {
    for (let index = 0; index < values.length; index += 1) this.bytes.push(values[index])
  }
  /** Data split into sub-blocks of at most 255 bytes, each prefixed by its length, then a zero terminator. */
  blocks(data: Uint8Array) {
    for (let at = 0; at < data.length; at += 255) {
      const chunk = data.subarray(at, at + 255)
      this.byte(chunk.length)
      this.all(chunk)
    }
    this.byte(0)
  }
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * Encode frames as a GIF89a. Yields between frames — quantising, dithering and
 * compressing a frame is tens of milliseconds — and reports progress, so a
 * long recording encodes without freezing the page.
 */
export async function gifRecorderEncode(
  frames: GifRecorderFrame[],
  { palette = 'global', dither = true, loop = true }: GifRecorderEncodeOptions = {},
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  if (!frames.length) throw new Error('There are no frames to encode.')
  const { width, height } = frames[0]
  const sample = (list: GifRecorderFrame[]) => {
    const pixels = list.reduce((sum, frame) => sum + frame.width * frame.height, 0)
    const stride = Math.max(1, Math.floor(pixels / 60000))
    const out: number[] = []
    let counter = 0
    for (const frame of list)
      for (let index = 0; index < frame.width * frame.height; index += 1, counter += 1)
        if (counter % stride === 0) out.push(frame.data[index * 4], frame.data[index * 4 + 1], frame.data[index * 4 + 2])
    return Uint8Array.from(out)
  }
  const global = palette === 'global' ? quantize(sample(frames)) : null

  const writer = new Writer()
  writer.text('GIF89a')
  writer.short(width)
  writer.short(height)
  // Global table flag, 8-bit colour resolution, 256 entries (2^(7+1)).
  writer.byte(global ? 0xf7 : 0x70)
  writer.byte(0)
  writer.byte(0)
  if (global) writer.all(global)
  if (loop) {
    writer.all([0x21, 0xff, 11])
    writer.text('NETSCAPE2.0')
    writer.all([3, 1])
    writer.short(0)
    writer.byte(0)
  }

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]
    const table = global ?? quantize(sample([frame]))
    const pixels = indexFrame(frame, table, dither)
    // Graphic control extension: disposal “leave in place”, delay in hundredths.
    writer.all([0x21, 0xf9, 4, 0x04])
    writer.short(Math.max(2, Math.round(frame.delay / 10)))
    writer.all([0, 0])
    writer.byte(0x2c)
    writer.short(0)
    writer.short(0)
    writer.short(frame.width)
    writer.short(frame.height)
    writer.byte(global ? 0 : 0x87)
    if (!global) writer.all(table)
    writer.byte(8)
    writer.blocks(gifRecorderLzw(pixels, 8))
    onProgress?.(index + 1, frames.length)
    await tick()
  }
  writer.byte(0x3b)
  return new Blob([Uint8Array.from(writer.bytes)], { type: 'image/gif' })
}
