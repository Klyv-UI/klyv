/**
 * An ANSI terminal subset for AnsiOutput: a streaming escape-sequence parser
 * feeding a small screen of styled cells.
 *
 * It understands what build tools and CLIs actually print: SGR colour and
 * style (16, 256 and truecolour), carriage return to redraw a progress bar,
 * erase in line, cursor up/down/left/right and column for multi-line progress,
 * erase in display, backspace and tabs, and OSC 8 hyperlinks. A sequence split
 * across two chunks is held until the rest arrives. Anything else is dropped
 * silently, as a terminal would.
 */

export interface AnsiOutputStyle {
  /** Palette index 0–255, or an `rgb(…)` string for truecolour. */
  fg?: number | string
  bg?: number | string
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  inverse?: boolean
  strike?: boolean
  /** A safe hyperlink target from OSC 8. */
  href?: string
}

export interface AnsiOutputCell {
  ch: string
  style: AnsiOutputStyle
}

const EMPTY: AnsiOutputStyle = {}
const SAFE_URL = /^(?:https?:|mailto:)/i

/** Whether an OSC 8 target may become a link: http, https and mailto only. */
export function safeHref(url: string): string | undefined {
  const trimmed = url.trim()
  if (!SAFE_URL.test(trimmed)) return undefined
  try {
    return new URL(trimmed).href
  } catch {
    return undefined
  }
}

/** Colour of a 256-palette index above 15, as an `rgb()` string. */
export function paletteRgb(index: number): string {
  if (index >= 232) {
    const level = 8 + (index - 232) * 10
    return `rgb(${level} ${level} ${level})`
  }
  const cube = index - 16
  const steps = [0, 95, 135, 175, 215, 255]
  return `rgb(${steps[Math.floor(cube / 36)]} ${steps[Math.floor(cube / 6) % 6]} ${steps[cube % 6]})`
}

export class AnsiOutputScreen {
  lines: AnsiOutputCell[][] = [[]]
  /** Bumped per line on every write, so a renderer can skip unchanged lines. */
  versions: number[] = [0]
  row = 0
  col = 0
  private style: AnsiOutputStyle = EMPTY
  private pending = ''
  /** Lines dropped from the top to stay under the limit. */
  dropped = 0

  constructor(private readonly maxLines = 2000) {}

  private touch(row: number) {
    this.versions[row] = (this.versions[row] ?? 0) + 1
  }

  private ensure(row: number) {
    while (this.lines.length <= row) {
      this.lines.push([])
      this.versions.push(0)
    }
  }

  private put(ch: string) {
    this.ensure(this.row)
    const line = this.lines[this.row]
    while (line.length < this.col) line.push({ ch: ' ', style: EMPTY })
    line[this.col] = { ch, style: this.style }
    this.col++
    this.touch(this.row)
  }

  private newline() {
    this.row++
    this.col = 0
    this.ensure(this.row)
    if (this.lines.length > this.maxLines) {
      const extra = this.lines.length - this.maxLines
      this.lines.splice(0, extra)
      this.versions.splice(0, extra)
      this.row -= extra
      this.dropped += extra
    }
  }

  private sgr(params: number[]) {
    let s = { ...this.style }
    if (params.length === 0) params = [0]
    for (let i = 0; i < params.length; i++) {
      const p = params[i]
      if (p === 0) s = {}
      else if (p === 1) s.bold = true
      else if (p === 2) s.dim = true
      else if (p === 3) s.italic = true
      else if (p === 4) s.underline = true
      else if (p === 7) s.inverse = true
      else if (p === 9) s.strike = true
      else if (p === 21 || p === 22) (s.bold = false), (s.dim = false)
      else if (p === 23) s.italic = false
      else if (p === 24) s.underline = false
      else if (p === 27) s.inverse = false
      else if (p === 29) s.strike = false
      else if (p >= 30 && p <= 37) s.fg = p - 30
      else if (p >= 90 && p <= 97) s.fg = p - 90 + 8
      else if (p >= 40 && p <= 47) s.bg = p - 40
      else if (p >= 100 && p <= 107) s.bg = p - 100 + 8
      else if (p === 39) delete s.fg
      else if (p === 49) delete s.bg
      else if (p === 38 || p === 48) {
        const key = p === 38 ? 'fg' : 'bg'
        if (params[i + 1] === 5 && params[i + 2] !== undefined) {
          const n = params[i + 2]
          if (n >= 0 && n <= 255) s[key] = n < 16 ? n : paletteRgb(n)
          i += 2
        } else if (params[i + 1] === 2 && params[i + 4] !== undefined) {
          const [r, g, b] = params.slice(i + 2, i + 5).map((v) => Math.max(0, Math.min(255, v)))
          s[key] = `rgb(${r} ${g} ${b})`
          i += 4
        }
      }
    }
    // Keep the link: it is set by OSC 8, not by SGR.
    this.style = this.style.href ? { ...s, href: this.style.href } : s
  }

  private csi(body: string, final: string) {
    // Private-mode sequences (cursor show/hide, bracketed paste…) change nothing we draw.
    if (/^[?<>=]/.test(body)) return
    // Colon sub-parameters (38:2::r:g:b, with its empty colour-space slot) read
    // like their semicolon form.
    const params: number[] = []
    if (body !== '') {
      for (const part of body.split(';')) {
        const sub = part.split(':')
        if (sub.length === 6 && sub[1] === '2') sub.splice(2, 1)
        for (const value of sub) params.push(value === '' ? 0 : Number(value) || 0)
      }
    }
    const n = Math.max(1, params[0] ?? 1)
    switch (final) {
      case 'm':
        this.sgr(params)
        break
      case 'A':
        this.row = Math.max(0, this.row - n)
        break
      case 'B':
        this.row += n
        this.ensure(this.row)
        break
      case 'C':
        this.col += n
        break
      case 'D':
        this.col = Math.max(0, this.col - n)
        break
      case 'G':
        this.col = Math.max(0, n - 1)
        break
      case 'K': {
        this.ensure(this.row)
        const line = this.lines[this.row]
        const mode = params[0] ?? 0
        if (mode === 0) line.length = Math.min(line.length, this.col)
        else if (mode === 1) for (let c = 0; c <= this.col && c < line.length; c++) line[c] = { ch: ' ', style: EMPTY }
        else if (mode === 2) line.length = 0
        this.touch(this.row)
        break
      }
      case 'J': {
        const mode = params[0] ?? 0
        if (mode === 2 || mode === 3) {
          this.lines = this.lines.map(() => [])
          this.lines.forEach((_, row) => this.touch(row))
        } else if (mode === 0) {
          this.ensure(this.row)
          this.lines[this.row].length = Math.min(this.lines[this.row].length, this.col)
          for (let row = this.row + 1; row < this.lines.length; row++) this.lines[row] = []
          this.lines.forEach((_, row) => row >= this.row && this.touch(row))
        }
        break
      }
    }
  }

  private osc(body: string) {
    // OSC 8 ; params ; URI — an empty URI closes the link.
    const match = /^8;[^;]*;(.*)$/s.exec(body)
    if (!match) return
    const href = match[1] ? safeHref(match[1]) : undefined
    const { href: _drop, ...rest } = this.style
    void _drop
    this.style = href ? { ...rest, href } : rest
  }

  /** Feed more output. Incomplete escape sequences wait for the next chunk. */
  write(chunk: string) {
    const text = this.pending + chunk
    this.pending = ''
    let i = 0
    while (i < text.length) {
      const c = text[i]
      if (c === '\x1b') {
        const next = text[i + 1]
        if (next === undefined) {
          this.pending = text.slice(i)
          return
        }
        if (next === '[') {
          let j = i + 2
          while (j < text.length && !/[\x40-\x7e]/.test(text[j])) j++
          if (j >= text.length) {
            this.pending = text.slice(i)
            return
          }
          this.csi(text.slice(i + 2, j), text[j])
          i = j + 1
          continue
        }
        if (next === ']') {
          const bel = text.indexOf('\x07', i + 2)
          const st = text.indexOf('\x1b\\', i + 2)
          const end = bel === -1 ? st : st === -1 ? bel : Math.min(bel, st)
          if (end === -1) {
            this.pending = text.slice(i)
            return
          }
          this.osc(text.slice(i + 2, end))
          i = end + (text[end] === '\x07' ? 1 : 2)
          continue
        }
        // A two-character escape we do not draw (ESC 7, ESC =, charset selection…).
        i += next === '(' || next === ')' ? 3 : 2
        continue
      }
      if (c === '\n') this.newline()
      else if (c === '\r') this.col = 0
      else if (c === '\b') this.col = Math.max(0, this.col - 1)
      else if (c === '\t') {
        const stop = (Math.floor(this.col / 8) + 1) * 8
        while (this.col < stop) this.put(' ')
      } else if (c >= ' ' && c !== '\x7f') this.put(c)
      i++
    }
  }

  /** Plain text of the screen, for copying. */
  text(): string {
    return this.lines.map((line) => line.map((cell) => cell.ch).join('').trimEnd()).join('\n')
  }
}

/** Runs of identically styled cells in one line. */
export function runsOf(line: AnsiOutputCell[]): { text: string; style: AnsiOutputStyle }[] {
  const runs: { text: string; style: AnsiOutputStyle }[] = []
  for (const cell of line) {
    const last = runs[runs.length - 1]
    if (last && last.style === cell.style) last.text += cell.ch
    else runs.push({ text: cell.ch, style: cell.style })
  }
  return runs
}
