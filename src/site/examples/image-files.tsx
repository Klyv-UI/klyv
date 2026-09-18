import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  DocumentScanner,
  ExifViewer,
  Field,
  GifRecorder,
  IMAGE_ADJUST_DEFAULTS,
  ImageAdjust,
  MeasureTool,
  ModelViewer,
  PaletteExtractor,
  PathEditor,
  SegmentedControl,
  SmartCrop,
  Text,
  Textarea,
  ZipBrowser,
  zipBrowserCrc32,
  type ImageAdjustSettings,
  type MeasureToolMeasurement,
  type SmartCropRect,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ------------------------------------------------------------------ generated media
 *
 * Every image, model and archive on this page is made here, in code, when the
 * page opens: nothing is fetched. Raster scenes are painted on a canvas with a
 * little noise so the pixel components have texture to work on.
 */

type Paint = (context: CanvasRenderingContext2D, width: number, height: number) => void

/** A data: URL of a canvas painting, or '' where there is no canvas (a server, a test runner). */
function useCanvasImage(paint: Paint, width: number, height: number, type = 'image/png') {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return
    paint(context, width, height)
    setUrl(canvas.toDataURL(type, 0.9))
  }, [paint, width, height, type])
  return url
}

/** Deterministic noise, so the same scene is painted on every visit. */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

function grain(context: CanvasRenderingContext2D, width: number, height: number, amount: number, seed = 7) {
  const random = seeded(seed)
  const image = context.getImageData(0, 0, width, height)
  for (let at = 0; at < image.data.length; at += 4) {
    const shift = (random() - 0.5) * amount
    image.data[at] += shift
    image.data[at + 1] += shift
    image.data[at + 2] += shift
  }
  context.putImageData(image, 0, 0)
}

const paintLandscape: Paint = (context, width, height) => {
  const sky = context.createLinearGradient(0, 0, 0, height * 0.6)
  sky.addColorStop(0, '#f2b880')
  sky.addColorStop(0.55, '#f7d9a8')
  sky.addColorStop(1, '#bcd3d6')
  context.fillStyle = sky
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#fff1c9'
  context.beginPath()
  context.arc(width * 0.72, height * 0.3, height * 0.08, 0, Math.PI * 2)
  context.fill()
  const ridge = (base: number, amplitude: number, colour: string, seed: number) => {
    const random = seeded(seed)
    context.fillStyle = colour
    context.beginPath()
    context.moveTo(0, height)
    for (let x = 0; x <= width; x += width / 24) context.lineTo(x, base - Math.sin(x / (width / 5) + seed) * amplitude - random() * amplitude * 0.5)
    context.lineTo(width, height)
    context.fill()
  }
  ridge(height * 0.52, height * 0.1, '#7d8fa3', 2)
  ridge(height * 0.6, height * 0.08, '#4e6b5c', 5)
  const lake = context.createLinearGradient(0, height * 0.66, 0, height)
  lake.addColorStop(0, '#6f9bb0')
  lake.addColorStop(1, '#2f4b5c')
  context.fillStyle = lake
  context.fillRect(0, height * 0.68, width, height * 0.32)
  const random = seeded(11)
  for (let tree = 0; tree < 26; tree += 1) {
    const x = random() * width
    const base = height * (0.66 + random() * 0.04)
    const tall = height * (0.08 + random() * 0.08)
    context.fillStyle = tree % 3 ? '#2d4a38' : '#3e5f3f'
    context.beginPath()
    context.moveTo(x, base - tall)
    context.lineTo(x - tall * 0.28, base)
    context.lineTo(x + tall * 0.28, base)
    context.fill()
  }
  context.fillStyle = '#c0462f'
  context.fillRect(width * 0.2, height * 0.76, width * 0.12, height * 0.03)
  grain(context, width, height, 18)
}

const paintPortrait: Paint = (context, width, height) => {
  const wall = context.createLinearGradient(0, 0, width, 0)
  wall.addColorStop(0, '#d9dde0')
  wall.addColorStop(1, '#c7ced3')
  context.fillStyle = wall
  context.fillRect(0, 0, width, height)
  // A plant on the left, low: saturated and detailed, so it competes a little.
  context.fillStyle = '#8a5a3c'
  context.fillRect(width * 0.08, height * 0.72, width * 0.08, height * 0.28)
  const random = seeded(3)
  for (let leaf = 0; leaf < 30; leaf += 1) {
    context.fillStyle = leaf % 2 ? '#3f8a4a' : '#2f6e3a'
    context.beginPath()
    context.ellipse(width * (0.12 + (random() - 0.5) * 0.12), height * (0.62 + (random() - 0.5) * 0.2), width * 0.018, height * 0.05, random() * Math.PI, 0, Math.PI * 2)
    context.fill()
  }
  // The subject, right of centre: shoulders, neck, face, hair.
  const cx = width * 0.66
  context.fillStyle = '#2f5d8a'
  context.beginPath()
  context.ellipse(cx, height * 1.02, width * 0.17, height * 0.3, 0, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#d9a07c'
  context.fillRect(cx - width * 0.03, height * 0.5, width * 0.06, height * 0.2)
  context.beginPath()
  context.ellipse(cx, height * 0.42, width * 0.075, height * 0.16, 0, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#3b2a20'
  context.beginPath()
  context.ellipse(cx, height * 0.3, width * 0.08, height * 0.08, 0, Math.PI, Math.PI * 2)
  context.fill()
  context.fillStyle = '#2a1d16'
  for (const side of [-1, 1]) {
    context.beginPath()
    context.arc(cx + side * width * 0.026, height * 0.41, width * 0.007, 0, Math.PI * 2)
    context.fill()
  }
  context.strokeStyle = '#9c5a4a'
  context.lineWidth = width * 0.004
  context.beginPath()
  context.arc(cx, height * 0.46, width * 0.022, 0.15 * Math.PI, 0.85 * Math.PI)
  context.stroke()
  grain(context, width, height, 14, 5)
}

/** A page photographed at an angle on a desk, with the light falling off towards one corner. */
const paintDocument: Paint = (context, width, height) => {
  const desk = context.createLinearGradient(0, 0, width, height)
  desk.addColorStop(0, '#5b4636')
  desk.addColorStop(1, '#3a2b21')
  context.fillStyle = desk
  context.fillRect(0, 0, width, height)
  const corners = [
    [width * 0.24, height * 0.1],
    [width * 0.8, height * 0.16],
    [width * 0.86, height * 0.9],
    [width * 0.14, height * 0.84],
  ]
  // Bilinear position inside the page, so the text lines follow the page’s perspective.
  const at = (u: number, v: number) => {
    const top = [corners[0][0] + (corners[1][0] - corners[0][0]) * u, corners[0][1] + (corners[1][1] - corners[0][1]) * u]
    const bottom = [corners[3][0] + (corners[2][0] - corners[3][0]) * u, corners[3][1] + (corners[2][1] - corners[3][1]) * u]
    return [top[0] + (bottom[0] - top[0]) * v, top[1] + (bottom[1] - top[1]) * v] as const
  }
  const quad = (u0: number, v0: number, u1: number, v1: number) => {
    context.beginPath()
    context.moveTo(...at(u0, v0))
    context.lineTo(...at(u1, v0))
    context.lineTo(...at(u1, v1))
    context.lineTo(...at(u0, v1))
    context.closePath()
    context.fill()
  }
  const paper = context.createLinearGradient(corners[0][0], corners[0][1], corners[2][0], corners[2][1])
  paper.addColorStop(0, '#fbfaf6')
  paper.addColorStop(1, '#cfccc2')
  context.fillStyle = paper
  quad(0, 0, 1, 1)
  context.fillStyle = '#23262b'
  quad(0.1, 0.07, 0.62, 0.12)
  const random = seeded(19)
  for (let line = 0; line < 17; line += 1) {
    const v = 0.19 + line * 0.043
    if (line === 7) continue
    context.fillStyle = line === 8 ? '#2b4a7a' : '#4a4d52'
    quad(0.1, v, 0.1 + (line % 6 === 5 ? 0.45 : 0.72 + random() * 0.1), v + 0.014)
  }
  grain(context, width, height, 10, 9)
}

const FLOOR_PLAN = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">
<rect width="960" height="600" fill="#f7f5ef"/>
<g fill="none" stroke="#e3dfd3" stroke-width="1">${Array.from({ length: 24 }, (_, i) => `<path d="M${40 * i} 0V600M0 ${40 * i}H960"/>`).join('')}</g>
<g fill="none" stroke="#2c2f36" stroke-width="10" stroke-linejoin="square">
<path d="M80 80H880V520H80Z"/><path d="M440 80V300M440 380V520M80 300H300M380 300H440M640 80V240M640 320V520"/>
</g>
<g fill="#2c2f36" font-family="sans-serif" font-size="18" font-weight="700">
<text x="200" y="190">Living</text><text x="190" y="420">Bedroom</text><text x="510" y="190">Kitchen</text><text x="500" y="420">Bath</text><text x="720" y="300">Studio</text>
</g>
<g stroke="#2c2f36" stroke-width="3"><path d="M100 560H340M100 550V570M340 550V570"/></g>
<text x="220" y="590" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="#2c2f36">5 m</text>
</svg>`)}`

/* ------------------------------------------------------------------ PathEditor */

const PATHS = {
  heart: 'm240 110 c-30-50-120-40-120 30 c0 60 100 100 120 130 c20-30 120-70 120-130 c0-70-90-80-120-30z',
  badge: 'M120 240 Q120 80 240 80 Q360 80 360 240 H300 V300 H180 V240 Z',
  wave: 'M40 200 C120 80 200 80 240 200 S360 320 440 200',
}

function PathEditorExample() {
  const [d, setD] = useState(PATHS.heart)
  const [draft, setDraft] = useState(PATHS.heart)
  return (
    <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
      <PathEditor value={d} onValueChange={setD} label="Icon outline" defaultTool="select" />
      <div className="flex flex-col gap-3">
        <Field label="Path data to load" hint="Relative commands, H/V and Q are read and written back as absolute M/L/C/Z.">
          <Textarea rows={5} value={draft} onChange={(event) => setDraft(event.target.value)} className="font-mono text-[11px]" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="accent" onClick={() => setD(draft)}>
            Load
          </Button>
          <Button size="sm" variant="outline" onClick={() => (setDraft(PATHS.badge), setD(PATHS.badge))}>
            Quadratic badge
          </Button>
          <Button size="sm" variant="ghost" onClick={() => (setDraft(PATHS.wave), setD(PATHS.wave))}>
            Unsupported: S curve
          </Button>
        </div>
        <div className="flex items-center gap-3 rounded-[var(--radius-glyph)] bg-surface-sunken p-3">
          <svg viewBox="0 0 480 320" className="h-12 w-auto" aria-hidden="true">
            <path d={d} className="fill-accent stroke-ink" strokeWidth="6" />
          </svg>
          <Text size="caption" tone="faint">
            The output, rendered as an icon.
          </Text>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ ImageAdjust */

function ImageAdjustExample() {
  const src = useCanvasImage(paintLandscape, 900, 560)
  const [settings, setSettings] = useState<ImageAdjustSettings>({
    ...IMAGE_ADJUST_DEFAULTS,
    contrast: 12,
    saturation: 10,
    curves: { ...IMAGE_ADJUST_DEFAULTS.curves, rgb: [{ x: 0, y: 12 }, { x: 70, y: 58 }, { x: 190, y: 204 }, { x: 255, y: 250 }] },
  })
  const [exported, setExported] = useState<{ size: number; type: string } | null>(null)
  return (
    <div className="flex w-full flex-col gap-3">
      <ImageAdjust src={src} value={settings} onValueChange={setSettings} onExport={(blob) => setExported({ size: blob.size, type: blob.type })} label="Lake at sunset" />
      <Text size="caption" tone="faint" role="status">
        {exported ? `Exported ${exported.type}, ${(exported.size / 1024).toFixed(0)} KB.` : 'The curve starts as a gentle S; drag its points or add one.'}
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ SmartCrop */

function SmartCropExample() {
  const src = useCanvasImage(paintPortrait, 1200, 700)
  const [accepted, setAccepted] = useState<Record<string, SmartCropRect>>({})
  return (
    <div className="flex w-full flex-col gap-3">
      <SmartCrop src={src} alt="Portrait of a person standing right of centre, a plant on the left" defaultShowMap onAccept={(aspect, crop) => setAccepted((current) => ({ ...current, [aspect]: crop }))} />
      <Text size="caption" tone="faint">
        {Object.keys(accepted).length ? `Accepted: ${Object.keys(accepted).join(', ')}` : 'A centre crop would cut the face in half at 1:1; the suggestion keeps it on a third line.'}
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ DocumentScanner */

function DocumentScannerExample() {
  const src = useCanvasImage(paintDocument, 900, 680, 'image/jpeg')
  const [exported, setExported] = useState('')
  return (
    <div className="flex w-full flex-col gap-3">
      <DocumentScanner src={src} alt="A printed page photographed at an angle on a wooden desk" onExport={(blob) => setExported(`${blob.type}, ${(blob.size / 1024).toFixed(0)} KB`)} />
      <Text size="caption" tone="faint" role="status">
        {exported ? `Exported ${exported}.` : 'The photo is generated on this page; the corners were found by the component.'}
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ PaletteExtractor */

function PaletteExtractorExample() {
  const [scene, setScene] = useState<'landscape' | 'portrait'>('landscape')
  const landscape = useCanvasImage(paintLandscape, 600, 380)
  const portrait = useCanvasImage(paintPortrait, 600, 350)
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Image"
        size="sm"
        value={scene}
        onValueChange={setScene}
        className="self-start"
        options={[
          { value: 'landscape', label: 'Lake at sunset' },
          { value: 'portrait', label: 'Portrait' },
        ]}
      />
      <PaletteExtractor src={scene === 'landscape' ? landscape : portrait} alt={scene === 'landscape' ? 'Lake at sunset with pine trees' : 'Portrait against a grey wall'} variablePrefix="brand" />
    </div>
  )
}

/* ------------------------------------------------------------------ ModelViewer */

/** A (2,3) torus knot as a tube, written out as a binary STL. */
function torusKnotStl(segments = 220, sides = 14): ArrayBuffer {
  const curve = (t: number) => {
    const r = 2 + Math.cos(3 * t)
    return [r * Math.cos(2 * t) * 10, r * Math.sin(2 * t) * 10, Math.sin(3 * t) * 10]
  }
  const sub = (a: number[], b: number[]) => a.map((value, index) => value - b[index])
  const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const unit = (a: number[]) => {
    const length = Math.hypot(a[0], a[1], a[2]) || 1
    return a.map((value) => value / length)
  }
  const rings: number[][][] = []
  for (let i = 0; i < segments; i += 1) {
    const t = (i / segments) * Math.PI * 2
    const p = curve(t)
    const tangent = unit(sub(curve(t + 0.001), curve(t - 0.001)))
    const binormal = unit(cross(tangent, sub(sub(curve(t + 0.002), p), sub(p, curve(t - 0.002)))))
    const normal = cross(binormal, tangent)
    rings.push(
      Array.from({ length: sides }, (_, k) => {
        const a = (k / sides) * Math.PI * 2
        return p.map((value, axis) => value + 3.2 * (Math.cos(a) * normal[axis] + Math.sin(a) * binormal[axis]))
      }),
    )
  }
  const triangles: number[][][] = []
  for (let i = 0; i < segments; i += 1)
    for (let k = 0; k < sides; k += 1) {
      const a = rings[i][k]
      const b = rings[(i + 1) % segments][k]
      const c = rings[(i + 1) % segments][(k + 1) % sides]
      const d = rings[i][(k + 1) % sides]
      triangles.push([a, b, c], [a, c, d])
    }
  const buffer = new ArrayBuffer(84 + triangles.length * 50)
  const view = new DataView(buffer)
  new TextEncoder().encodeInto('Torus knot (2,3), generated in the browser', new Uint8Array(buffer, 0, 80))
  view.setUint32(80, triangles.length, true)
  triangles.forEach((triangle, index) => {
    const base = 84 + index * 50
    // The stored normal is left at zero, as many exporters do; the viewer computes its own.
    triangle.flat().forEach((value, at) => view.setFloat32(base + 12 + at * 4, value, true))
  })
  return buffer
}

const HEX_BOLT_OBJ = (() => {
  const lines = ['# Hex bolt head on a square shank. The hexagon caps are single six-sided faces, fanned into triangles.', 'o bolt']
  for (const z of [0, 7]) for (let k = 0; k < 6; k += 1) lines.push(`v ${(Math.cos((k * Math.PI) / 3) * 12).toFixed(3)} ${(Math.sin((k * Math.PI) / 3) * 12).toFixed(3)} ${z}`)
  lines.push('f 6 5 4 3 2 1', 'f 7/1 8/1 9/1 10/1 11/1 12/1')
  for (let k = 0; k < 6; k += 1) lines.push(`f ${k + 1}//1 ${((k + 1) % 6) + 1}//1 ${((k + 1) % 6) + 7}//1 ${k + 7}//1`)
  // The shank, written with negative indices that count back from the latest vertex.
  for (const z of [-30, 0]) for (const [x, y] of [[-4, -4], [4, -4], [4, 4], [-4, 4]]) lines.push(`v ${x} ${y} ${z}`)
  lines.push('f -5 -6 -7 -8')
  for (let k = 0; k < 4; k += 1) lines.push(`f ${k - 8} ${((k + 1) % 4) - 8} ${((k + 1) % 4) - 4} ${k - 4}`)
  return lines.join('\n')
})()

const WEDGE_STL = `solid wedge
${[
  [[0, 0, 0], [40, 0, 0], [40, 20, 0]],
  [[0, 0, 0], [40, 20, 0], [0, 20, 0]],
  [[0, 0, 0], [0, 20, 0], [0, 20, 15]],
  [[0, 0, 0], [0, 20, 15], [0, 0, 15]],
  [[0, 0, 15], [0, 20, 15], [40, 20, 0]],
  [[0, 0, 15], [40, 20, 0], [40, 0, 0]],
  [[0, 0, 0], [0, 0, 15], [40, 0, 0]],
  [[0, 20, 0], [40, 20, 0], [0, 20, 15]],
]
  .map((facet) => `facet normal 0 0 0\n outer loop\n${facet.map((v) => `  vertex ${v.join(' ')}`).join('\n')}\n endloop\nendfacet`)
  .join('\n')}
endsolid wedge`

function ModelViewerExample() {
  const [model, setModel] = useState<'knot' | 'bolt' | 'wedge'>('knot')
  const knot = useMemo(() => torusKnotStl(), [])
  const data = model === 'knot' ? knot : model === 'bolt' ? HEX_BOLT_OBJ : WEDGE_STL
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Model"
        size="sm"
        value={model}
        onValueChange={setModel}
        className="self-start"
        options={[
          { value: 'knot', label: 'Torus knot · binary STL' },
          { value: 'bolt', label: 'Hex bolt · OBJ' },
          { value: 'wedge', label: 'Wedge · ASCII STL' },
        ]}
      />
      <ModelViewer data={data} label={model === 'knot' ? 'Torus knot' : model === 'bolt' ? 'Hex bolt' : 'Wedge'} />
    </div>
  )
}

/* ------------------------------------------------------------------ ExifViewer */

type ExifValue = { tag: number; type: 2 | 3 | 4 | 5 | 10; value: string | number[] }

/** A TIFF structure with IFD0, an Exif IFD and a GPS IFD, in either byte order. */
function buildTiff(little: boolean): Uint8Array {
  const r = (value: number, denominator = 1000) => [Math.round(value * denominator), denominator]
  const exif: ExifValue[] = [
    { tag: 0x829a, type: 5, value: [1, 250] },
    { tag: 0x829d, type: 5, value: [28, 10] },
    { tag: 0x8822, type: 3, value: [3] },
    { tag: 0x8827, type: 3, value: [200] },
    { tag: 0x9003, type: 2, value: '2025:06:14 19:42:08' },
    { tag: 0x9204, type: 10, value: [-1, 3] },
    { tag: 0x9209, type: 3, value: [16] },
    { tag: 0x920a, type: 5, value: [35, 1] },
    { tag: 0xa405, type: 3, value: [52] },
    { tag: 0xa434, type: 2, value: 'Summicron 35mm f/2 ASPH' },
  ]
  const gps: ExifValue[] = [
    { tag: 0x0001, type: 2, value: 'N' },
    { tag: 0x0002, type: 5, value: [51, 1, 30, 1, ...r(26.42)] },
    { tag: 0x0003, type: 2, value: 'W' },
    { tag: 0x0004, type: 5, value: [0, 1, 7, 1, ...r(39.88)] },
    { tag: 0x0006, type: 5, value: r(21.5, 10) },
  ]
  const size = { 2: 1, 3: 2, 4: 4, 5: 8, 10: 8 } as const
  const count = (entry: ExifValue) => (entry.type === 2 ? (entry.value as string).length + 1 : entry.type >= 5 ? (entry.value as number[]).length / 2 : (entry.value as number[]).length)
  const extra = (entries: ExifValue[]) => entries.reduce((sum, entry) => {
    const bytes = count(entry) * size[entry.type]
    return sum + (bytes > 4 ? bytes + (bytes % 2) : 0)
  }, 0)
  const ifdSize = (entries: ExifValue[]) => 2 + entries.length * 12 + 4 + extra(entries)
  const ifd0Base: ExifValue[] = [
    { tag: 0x010f, type: 2, value: 'Leica Camera AG' },
    { tag: 0x0110, type: 2, value: 'LEICA Q2' },
    { tag: 0x0112, type: 3, value: [1] },
    { tag: 0x0131, type: 2, value: 'Klyv demo 1.0' },
    { tag: 0x0132, type: 2, value: '2025:06:15 09:10:00' },
    { tag: 0x8769, type: 4, value: [0] },
    { tag: 0x8825, type: 4, value: [0] },
  ]
  const exifAt = 8 + ifdSize(ifd0Base)
  const gpsAt = exifAt + ifdSize(exif)
  const ifd0 = ifd0Base.map((entry) => (entry.tag === 0x8769 ? { ...entry, value: [exifAt] } : entry.tag === 0x8825 ? { ...entry, value: [gpsAt] } : entry))

  const out = new Uint8Array(gpsAt + ifdSize(gps))
  const view = new DataView(out.buffer)
  out.set(little ? [0x49, 0x49] : [0x4d, 0x4d])
  view.setUint16(2, 42, little)
  view.setUint32(4, 8, little)
  const write = (entries: ExifValue[], start: number) => {
    view.setUint16(start, entries.length, little)
    let data = start + 2 + entries.length * 12 + 4
    entries.forEach((entry, index) => {
      const at = start + 2 + index * 12
      const n = count(entry)
      view.setUint16(at, entry.tag, little)
      view.setUint16(at + 2, entry.type, little)
      view.setUint32(at + 4, n, little)
      const bytes = n * size[entry.type]
      const target = bytes > 4 ? data : at + 8
      if (bytes > 4) {
        view.setUint32(at + 8, data, little)
        data += bytes + (bytes % 2)
      }
      if (entry.type === 2) [...(entry.value as string)].forEach((character, k) => (out[target + k] = character.charCodeAt(0)))
      else
        (entry.value as number[]).forEach((value, k) => {
          if (entry.type === 3) view.setUint16(target + k * 2, value, little)
          else if (entry.type === 4 || entry.type === 5) view.setUint32(target + k * 4, value, little)
          else view.setInt32(target + k * 4, value, little)
        })
    })
    view.setUint32(start + 2 + entries.length * 12, 0, little)
  }
  write(ifd0, 8)
  write(exif, exifAt)
  write(gps, gpsAt)
  return out
}

const segment = (marker: number, payload: Uint8Array) => {
  const out = new Uint8Array(payload.length + 4)
  out.set([0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff])
  out.set(payload, 4)
  return out
}
const ascii = (text: string) => Uint8Array.from([...text].map((character) => character.charCodeAt(0)))
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/** A real JPEG from a canvas, with an EXIF APP1 and an IPTC APP13 spliced in after the start marker. */
function useJpegWithExif(little: boolean) {
  const [file, setFile] = useState<Blob | null>(null)
  useEffect(() => {
    let cancelled = false
    const tiff = buildTiff(little)
    const app1 = segment(0xe1, concat(ascii('Exif\0\0'), tiff))
    const app13 = segment(0xed, concat(ascii('Photoshop 3.0\0'), ascii('8BIM'), Uint8Array.from([0x04, 0x04, 0, 0, 0, 0, 0, 16, 0x1c, 0x02, 0x50, 0, 11]), ascii('Mira Okafor'), Uint8Array.from([0])))
    const finish = (jpeg: Uint8Array) => !cancelled && setFile(new Blob([concat(jpeg.subarray(0, 2), app1, app13, jpeg.subarray(2)) as BlobPart], { type: 'image/jpeg' }))
    const canvas = document.createElement('canvas')
    canvas.width = 480
    canvas.height = 320
    const context = canvas.getContext('2d')
    if (context && typeof canvas.toBlob === 'function') {
      paintLandscape(context, 480, 320)
      canvas.toBlob((blob) => blob?.arrayBuffer().then((buffer) => finish(new Uint8Array(buffer))), 'image/jpeg', 0.85)
    } else {
      // No canvas here: a JPEG skeleton with the right segments, so the metadata can still be read.
      finish(concat(Uint8Array.from([0xff, 0xd8]), segment(0xdb, new Uint8Array(65)), segment(0xc0, Uint8Array.from([8, 0, 1, 0, 1, 1, 1, 0x11, 0])), segment(0xda, Uint8Array.from([1, 1, 0, 0, 63, 0])), Uint8Array.from([0x00, 0xff, 0xd9])))
    }
    return () => {
      cancelled = true
    }
  }, [little])
  return file
}

function ExifViewerExample() {
  const [order, setOrder] = useState<'little' | 'big'>('little')
  const file = useJpegWithExif(order === 'little')
  const [stripped, setStripped] = useState<number | null>(null)
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="EXIF byte order"
        size="sm"
        value={order}
        onValueChange={(next) => (setOrder(next), setStripped(null))}
        className="self-start"
        options={[
          { value: 'little', label: 'Intel · II' },
          { value: 'big', label: 'Motorola · MM' },
        ]}
      />
      {file ? <ExifViewer file={file} fileName="L1004817.jpg" onStrip={(blob) => setStripped(blob.size)} /> : <Text size="caption" tone="faint">Building the JPEG…</Text>}
      {stripped !== null && (
        <Text size="caption" tone="faint">
          onStrip received {stripped.toLocaleString()} bytes.
        </Text>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ ZipBrowser */

async function deflate(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new ReadableStream<BufferSource>({
      start(controller) {
        controller.enqueue(data as BufferSource)
        controller.close()
      },
    }).pipeThrough(new CompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

/** A ZIP written by hand: local headers, data, central directory, end record. */
async function buildZip(files: { name: string; data: Uint8Array; store?: boolean }[]): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  const time = (14 << 11) | (32 << 5) | 5
  const date = ((2025 - 1980) << 9) | (6 << 5) | 14
  for (const file of files) {
    const name = encoder.encode(file.name)
    const utf8 = /[^\x20-\x7e]/.test(file.name)
    const packed = file.store ? null : await deflate(file.data)
    const body = packed ?? file.data
    const method = packed ? 8 : 0
    const crc = zipBrowserCrc32(file.data)
    const header = (central: boolean) => {
      const out = new Uint8Array((central ? 46 : 30) + name.length)
      const view = new DataView(out.buffer)
      let at = 0
      view.setUint32(at, central ? 0x02014b50 : 0x04034b50, true)
      at += 4
      if (central) {
        view.setUint16(at, 20, true)
        at += 2
      }
      view.setUint16(at, 20, true)
      view.setUint16(at + 2, utf8 ? 0x800 : 0, true)
      view.setUint16(at + 4, method, true)
      view.setUint16(at + 6, time, true)
      view.setUint16(at + 8, date, true)
      view.setUint32(at + 10, crc, true)
      view.setUint32(at + 14, body.length, true)
      view.setUint32(at + 18, file.data.length, true)
      view.setUint16(at + 22, name.length, true)
      if (central) view.setUint32(at + 36, offset, true)
      out.set(name, central ? 46 : 30)
      return out
    }
    centrals.push(header(true))
    const local = concat(header(false), body)
    locals.push(local)
    offset += local.length
  }
  const directory = concat(...centrals)
  const end = new Uint8Array(22)
  const view = new DataView(end.buffer)
  view.setUint32(0, 0x06054b50, true)
  view.setUint16(8, files.length, true)
  view.setUint16(10, files.length, true)
  view.setUint32(12, directory.length, true)
  view.setUint32(16, offset, true)
  return concat(...locals, directory, end)
}

const README = `# Northwind dashboard export

Generated on 14 June 2025. Contains the source of the sales dashboard, the
raw monthly figures and the logo used in the header.

- src/ — components and entry point
- data/ — CSV, one row per region per month
- assets/ — logo and a rendered chart
`

function ZipBrowserExample() {
  const [zip, setZip] = useState<Blob | null>(null)
  useEffect(() => {
    let cancelled = false
    const encoder = new TextEncoder()
    const regions = ['North', 'South', 'East', 'West', 'Central']
    const csv = ['month,region,orders,revenue']
    for (let month = 1; month <= 12; month += 1) regions.forEach((region, index) => csv.push(`2024-${String(month).padStart(2, '0')},${region},${120 + ((month * 37 + index * 11) % 90)},${(18000 + ((month * 971 + index * 313) % 9000)).toFixed(2)}`))
    const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect width="120" height="40" rx="8" fill="#1f3b5c"/><circle cx="20" cy="20" r="9" fill="#f2b880"/><text x="36" y="26" font-family="sans-serif" font-size="15" font-weight="700" fill="#fff">Northwind</text></svg>`
    const files = [
      { name: 'README.md', data: encoder.encode(README) },
      { name: 'src/index.ts', data: encoder.encode(`export { Dashboard } from './Dashboard'\nexport { formatRevenue } from './format'\n`) },
      { name: 'src/Dashboard.tsx', data: encoder.encode(`import { formatRevenue } from './format'\n\nexport function Dashboard({ rows }: { rows: { region: string; revenue: number }[] }) {\n  return (\n    <table>\n      {rows.map((row) => (\n        <tr key={row.region}>\n          <td>{row.region}</td>\n          <td>{formatRevenue(row.revenue)}</td>\n        </tr>\n      ))}\n    </table>\n  )\n}\n`) },
      { name: 'src/format.ts', data: encoder.encode(`export const formatRevenue = (value: number) =>\n  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)\n`) },
      { name: 'data/sales-2024.csv', data: encoder.encode(csv.join('\n')) },
      { name: 'assets/logo.svg', data: encoder.encode(logo), store: true },
      { name: 'docs/café-menü.txt', data: encoder.encode('Filenames with accents are stored with the UTF-8 flag set.\n') },
    ]
    buildZip(files).then((bytes) => !cancelled && setZip(new Blob([bytes as BlobPart], { type: 'application/zip' })))
    return () => {
      cancelled = true
    }
  }, [])
  const [extracted, setExtracted] = useState('')
  return (
    <div className="flex w-full flex-col gap-3">
      {zip ? <ZipBrowser file={zip} fileName="northwind-export.zip" onExtract={(entry, data) => setExtracted(`${entry.name}, ${data.length.toLocaleString()} bytes`)} /> : <Text size="caption" tone="faint">Building the archive…</Text>}
      <Text size="caption" tone="faint" role="status">
        {extracted ? `Extracted ${extracted}.` : 'The archive is built on this page: text entries deflated with CompressionStream, the logo stored.'}
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------------ GifRecorder */

function GifRecorderExample() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [playing, setPlaying] = useState(false)
  const [recorded, setRecorded] = useState('')

  useEffect(() => {
    // Still under reduced motion until the reader presses play.
    setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const styles = getComputedStyle(canvas)
    const accent = styles.getPropertyValue('--color-accent').trim() || '#8bc34a'
    const ink = styles.getPropertyValue('--color-ink').trim() || '#222222'
    const paper = styles.getPropertyValue('--color-surface').trim() || '#ffffff'
    let frame = 0
    let handle = 0
    const draw = (time: number) => {
      const { width, height } = canvas
      context.fillStyle = paper
      context.fillRect(0, 0, width, height)
      for (let k = 0; k < 6; k += 1) {
        const angle = time / 700 + (k * Math.PI) / 3
        context.fillStyle = k % 2 ? accent : ink
        context.beginPath()
        context.arc(width / 2 + Math.cos(angle) * 70, height / 2 + Math.sin(angle * 1.5) * 42, 14 + 6 * Math.sin(time / 300 + k), 0, Math.PI * 2)
        context.fill()
      }
      context.fillStyle = ink
      context.font = '700 14px sans-serif'
      context.fillText(`frame ${frame}`, 12, 22)
      frame += 1
      if (playing) handle = requestAnimationFrame(draw)
    }
    handle = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(handle)
  }, [playing])

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <canvas ref={canvasRef} width={320} height={180} role="img" aria-label="Animated orbiting dots" className="rounded-[var(--radius-tile)] border border-line" />
        <Button size="sm" variant="outline" aria-pressed={playing} onClick={() => setPlaying(!playing)}>
          {playing ? 'Pause animation' : 'Play animation'}
        </Button>
      </div>
      <GifRecorder source={canvasRef} fps={15} maxDuration={3} onRecord={(blob) => setRecorded(`${(blob.size / 1024).toFixed(0)} KB`)} fileName="orbit.gif" />
      {recorded && (
        <Text size="caption" tone="faint">
          onRecord received a {recorded} GIF.
        </Text>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ MeasureTool */

const PLAN_MEASUREMENTS: MeasureToolMeasurement[] = [
  { id: 'living-wall', kind: 'distance', points: [{ x: 80, y: 80 }, { x: 440, y: 80 }] },
  { id: 'studio', kind: 'area', points: [{ x: 640, y: 80 }, { x: 880, y: 80 }, { x: 880, y: 520 }, { x: 640, y: 520 }] },
]

function MeasureToolExample() {
  const [measurements, setMeasurements] = useState(PLAN_MEASUREMENTS)
  return (
    <MeasureTool
      src={FLOOR_PLAN}
      alt="Floor plan of a flat with living room, bedroom, kitchen, bath and studio, with a 5 metre scale bar"
      value={measurements}
      onValueChange={setMeasurements}
      defaultCalibration={{ points: [{ x: 100, y: 560 }, { x: 340, y: 560 }], length: 5, unit: 'm' }}
      units={['m', 'cm', 'ft']}
    />
  )
}

/* ------------------------------------------------------------------ pages */

const IMAGE_PROPS = [{ name: 'src', type: 'string', description: 'Image URL — data:, blob:, same-origin or CORS-enabled. Pixels are read, so a tainted image shows an error.' }]

export const demos: ExampleModule = {
  'path-editor': {
    description:
      'A pen tool for SVG paths that edits real path data. Click places a corner, drag places a smooth anchor with mirrored handles, clicking a segment splits it with de Casteljau so the shape does not move, and double-click converts corner and smooth. Relative commands, H/V and quadratics are parsed; what comes out is normalised absolute M/L/C/Z. Every anchor is a focusable button that arrows nudge.',
    sections: [
      { title: 'Editing an icon outline', Content: PathEditorExample },
      rationale(
        'Tweaking an icon or a chart annotation means a round trip to a design tool, or editing numbers in a d attribute by hand.',
        'Curve splitting, handle mirroring and a real parser make it an editor rather than a point plotter, and the normalised output diffs cleanly.',
        'Icon and shape builders, custom chart annotations, mask and clip-path editors, and anywhere users bring their own SVG.',
        ['SegmentedControl', 'Button', 'CopyButton', 'SVG'],
      ),
    ],
    props: [
      { name: 'value / defaultValue', type: 'string', description: 'Path data, controlled or uncontrolled. Anything the parser reads.' },
      { name: 'onValueChange', type: '(d: string) => void', description: 'Normalised absolute path data after every edit.' },
      { name: 'width / height', type: 'number', defaultValue: '480 / 320', description: 'The drawing’s viewBox size.' },
      { name: 'defaultTool', type: "'pen' | 'select'", defaultValue: "'pen'", description: 'Tool selected at first.' },
      { name: 'label', type: 'string', defaultValue: "'Path editor'", description: 'Accessible name for the drawing.' },
    ],
  },

  'image-adjust': {
    description:
      'Photo adjustments that run on the pixels: exposure, contrast, saturation, white balance, levels and tone curves per channel. Every per-channel control folds into one 256-entry table per channel, curve points are joined by a monotone cubic spline that cannot overshoot, and the loop runs in slices so dragging never locks the page. The histogram under the curve is of the result, so clipping shows while it happens.',
    sections: [
      { title: 'Grading a landscape', Content: ImageAdjustExample },
      rationale(
        'Cropping and uploading is easy; correcting a dark or colour-cast photo before it goes up usually means another app.',
        'A LUT pipeline makes every control cost the same, and a monotone spline gives curves that behave like the ones in photo editors.',
        'Avatar and product-photo uploads, CMS media libraries, listing editors, and anywhere a quick fix saves a round trip.',
        ['Slider', 'SegmentedControl', 'Button', 'canvas'],
      ),
    ],
    props: [
      ...IMAGE_PROPS,
      { name: 'value / defaultValue', type: 'ImageAdjustSettings', description: 'Exposure, contrast, saturation, temperature, curves, levels, rotation and flips.' },
      { name: 'onValueChange', type: '(value: ImageAdjustSettings) => void', description: 'Called whenever a control moves.' },
      { name: 'onExport', type: '(blob: Blob) => void', description: 'Shows an Export button; receives the adjusted, rotated image.' },
      { name: 'exportType', type: "'image/png' | 'image/jpeg' | 'image/webp'", defaultValue: "'image/png'", description: 'Encoding for the export.' },
      { name: 'maxSize', type: 'number', defaultValue: '1600', description: 'Longest side processed, in pixels.' },
    ],
  },

  'smart-crop': {
    description:
      'Suggests a crop per aspect ratio that keeps the subject. The image is scored on a coarse grid — Sobel edge energy, skin tones and strong colour — and every candidate crop is searched, rewarding interest on a third line and penalising interest cut off. The suggestion can be dragged, resized or nudged with the keyboard, and the score map can be shown so the reason for it is visible. Crops come out as fractions.',
    sections: [
      { title: 'One photo, three layouts', Content: SmartCropExample },
      rationale(
        'A centre crop for a square thumbnail beheads anyone standing off-centre, and hand-cropping every aspect ratio does not scale.',
        'Saliency plus a rule-of-thirds search gets a good first answer without a model, and the reader can still correct it.',
        'Upload flows that generate thumbnails, social cards and hero images, media libraries, and e-commerce galleries.',
        ['SegmentedControl', 'Switch', 'Button', 'canvas'],
      ),
    ],
    props: [
      ...IMAGE_PROPS,
      { name: 'alt', type: 'string', description: 'Alt text for the image.' },
      { name: 'aspects', type: 'string[]', defaultValue: "['1:1', '4:5', '16:9']", description: 'Aspect ratios to suggest crops for, width:height.' },
      { name: 'onAccept', type: '(aspect: string, crop: SmartCropRect) => void', description: 'A crop was accepted; x, y, width, height as fractions.' },
      { name: 'onCropsChange', type: '(crops: Record<string, SmartCropRect>) => void', description: 'Every current crop, whenever one moves.' },
      { name: 'defaultShowMap', type: 'boolean', defaultValue: 'false', description: 'Show the interest map at first.' },
    ],
  },

  'document-scanner': {
    description:
      'Turns a photo of a page into a flat scan. The page is found with blur, Canny-style edges, the largest connected contour and the four hull corners enclosing the most area; the corners stay draggable and focusable because a wrong one is fixed fastest by hand. Flattening is a true homography solved from the corners with bilinear sampling, and the scanned look is an adaptive threshold that survives uneven light.',
    sections: [
      { title: 'A page on a desk', Content: DocumentScannerExample },
      rationale(
        'Receipts, forms and ID pages arrive as skewed phone photos that are hard to read and waste most of their pixels on the table.',
        'Detection plus editable corners plus a real perspective warp is the whole scanning-app workflow, with no server round trip.',
        'Expense receipts, onboarding document capture, signed-form uploads, and field inspection apps.',
        ['Switch', 'Button', 'canvas', 'SVG'],
      ),
    ],
    props: [
      ...IMAGE_PROPS,
      { name: 'alt', type: 'string', description: 'Alt text for the photo.' },
      { name: 'onExport', type: '(blob: Blob) => void', description: 'Shows an Export button; receives the flattened page.' },
      { name: 'defaultScanLook', type: 'boolean', defaultValue: 'false', description: 'Start with the black-and-white threshold on.' },
      { name: 'maxOutputSize', type: 'number', defaultValue: '2000', description: 'Longest side of the exported page.' },
    ],
  },

  'palette-extractor': {
    description:
      'The dominant colours of an image with the share of it each one covers. Median cut splits colour space where the pixels are, optional k-means rounds pull each colour to its cluster’s centre, and shares come from assigning every sampled pixel. Swatches carry hex, OKLCH and a text colour chosen by WCAG contrast, and the palette copies as CSS custom properties.',
    sections: [
      { title: 'From a photo to variables', Content: PaletteExtractorExample },
      rationale(
        'Picking brand or theme colours from a photo by eyedropper gives one pixel’s colour, not the image’s.',
        'Median cut weighted by population finds the colours that matter, and contrast-checked ink makes each one usable at once.',
        'Theme builders, cover-art backdrops, product listings that tint their page, and moodboards.',
        ['Slider', 'Switch', 'SegmentedControl', 'CopyButton'],
      ),
    ],
    props: [
      ...IMAGE_PROPS,
      { name: 'alt', type: 'string', description: 'Alt text for the image.' },
      { name: 'defaultCount', type: 'number', defaultValue: '6', description: 'Colours to extract at first, 2–12.' },
      { name: 'defaultRefine', type: 'boolean', defaultValue: 'true', description: 'Refine with k-means at first.' },
      { name: 'variablePrefix', type: 'string', defaultValue: "'palette'", description: 'Prefix of the copied custom properties.' },
      { name: 'onPaletteChange', type: '(colors: PaletteExtractorColor[]) => void', description: 'The palette, most common first, whenever it is recomputed.' },
    ],
  },

  'model-viewer': {
    description:
      'A WebGL viewer for STL (binary and ASCII) and OBJ, parsers included. Normals are computed from the winding, the model is centred and scaled to fit whatever its units, and rotation is a quaternion arcball with no gimbal lock. The canvas is one tab stop — arrows rotate, plus and minus zoom, W toggles wireframe — and colours come from theme tokens at draw time. Frames are drawn only when something changes.',
    sections: [
      { title: 'Three formats', Content: ModelViewerExample, note: motionNote('nothing moves unless the reader drags or presses a key, so there is nothing to reduce.') },
      rationale(
        'A 3D print or CAD upload is a file the reader cannot see until it is downloaded into another program.',
        'Formats this simple deserve their own parsers rather than a 600 KB engine, and an arcball is the rotation people expect.',
        'Print-on-demand and maker marketplaces, CAD attachment previews, support tickets with parts, and asset libraries.',
        ['Switch', 'Button', 'WebGL'],
      ),
    ],
    props: [
      { name: 'data', type: 'ArrayBuffer | string', description: 'STL bytes (binary or ASCII), or OBJ as text or bytes.' },
      { name: 'format', type: "'stl' | 'obj'", description: 'Skip format detection.' },
      { name: 'height', type: 'number', defaultValue: '360', description: 'Canvas height in pixels.' },
      { name: 'defaultWireframe', type: 'boolean', defaultValue: 'false', description: 'Start in wireframe.' },
      { name: 'showBounds', type: 'boolean', defaultValue: 'true', description: 'Draw the bounding box.' },
      { name: 'unit', type: 'string', defaultValue: "'mm'", description: 'Unit shown with the dimensions.' },
      { name: 'label', type: 'string', defaultValue: "'3D model'", description: 'Accessible name for the viewer.' },
    ],
  },

  'exif-viewer': {
    description:
      'Reads what a photo says about where and when it was taken, and strips it without touching the picture. EXIF is parsed straight from the APP1 segment — TIFF header in either byte order, IFD0, Exif and GPS IFDs, rationals divided and enums named, GPS in decimal degrees. Stripping rewrites the segments without APP1 and APP13, then re-parses and compares every remaining byte before offering the file.',
    sections: [
      { title: 'A photo with location', Content: ExifViewerExample },
      rationale(
        'Photos shared from a phone carry the exact GPS position of the place they were taken, and most people do not know.',
        'Segment-level stripping keeps the image bit-identical, and verifying it proves that rather than promising it.',
        'Upload flows for marketplaces and communities, support attachments, press and HR tools, and privacy settings pages.',
        ['Badge', 'Button', 'CopyButton'],
      ),
    ],
    props: [
      { name: 'file', type: 'Blob | ArrayBuffer', description: 'The JPEG.' },
      { name: 'fileName', type: 'string', defaultValue: "'photo.jpg'", description: 'Shown in the header and used for the clean copy’s name.' },
      { name: 'onStrip', type: '(blob: Blob) => void', description: 'The metadata-free copy, after it has been verified.' },
    ],
  },

  'zip-browser': {
    description:
      'Opens a ZIP in the browser. The central directory is found from the end record — through the ZIP64 locator where needed — names honour the UTF-8 flag with a code page 437 fallback, and the folders become a keyboard tree. Opening a file inflates only that entry with DecompressionStream, checks its CRC-32, and previews text and images; Extract downloads it.',
    sections: [
      { title: 'An export archive', Content: ZipBrowserExample },
      rationale(
        'Checking what is in an archive — an export, a support bundle, a submission — means downloading and unpacking all of it.',
        'The central directory makes listing free, and inflating one entry at a time keeps large archives cheap.',
        'Data exports, support-bundle viewers, assignment and asset submissions, and file managers.',
        ['Badge', 'Button', 'internal icons', 'DecompressionStream'],
      ),
    ],
    props: [
      { name: 'file', type: 'Blob | ArrayBuffer', description: 'The archive.' },
      { name: 'fileName', type: 'string', defaultValue: "'archive.zip'", description: 'Shown as the tree’s heading.' },
      { name: 'onExtract', type: '(entry: ZipBrowserEntry, data: Uint8Array) => void', description: 'Called with an extracted file’s contents.' },
    ],
  },

  'gif-recorder': {
    description:
      'Records a canvas or an element to an animated GIF with an encoder written here: median-cut quantisation to one palette or one per frame, optional Floyd–Steinberg dithering, variable-width LZW and the looping block. Frames keep their real spacing, and encoding yields between frames with a progress bar, so a few seconds of animation never freezes the page.',
    sections: [
      {
        title: 'Recording a canvas',
        Content: GifRecorderExample,
        note: motionNote('the demo animation starts paused and plays only when asked; the recorder itself only shows a pulsing dot, which stops.'),
      },
      rationale(
        'A bug reproduction or a UI demo has to go through a screen recorder and a converter before it can go in a ticket.',
        'GIF still plays everywhere — trackers, chat, email — and an in-page encoder captures exactly the element in question.',
        'Bug reporters, design tools and playgrounds, chart and animation editors, and feedback widgets.',
        ['Button', 'SegmentedControl', 'Switch', 'canvas'],
      ),
    ],
    props: [
      { name: 'source', type: 'RefObject<HTMLElement | null>', description: 'Canvas, video or image copied directly; other elements rasterised through SVG.' },
      { name: 'fps', type: 'number', defaultValue: '12', description: 'Frames captured per second.' },
      { name: 'maxDuration', type: 'number', defaultValue: '4', description: 'Seconds before recording stops by itself.' },
      { name: 'maxWidth', type: 'number', defaultValue: '320', description: 'Frames are scaled down to this width.' },
      { name: 'onRecord', type: '(blob: Blob) => void', description: 'The finished GIF.' },
      { name: 'fileName', type: 'string', defaultValue: "'recording.gif'", description: 'Suggested download name.' },
    ],
  },

  'measure-tool': {
    description:
      'Measures real distances, areas and angles on an image. Draw along something of known length to set the scale and every value is restated in real units; until then they are in pixels and say so. Distances are polylines, areas use the shoelace formula, angles take three points. Points stay draggable, and a keyboard crosshair places them without a pointer.',
    sections: [
      { title: 'A floor plan', Content: MeasureToolExample },
      rationale(
        'Estimating a room, a roof or a part from a plan or photo means printing it and reaching for a ruler.',
        'Calibrating from a known length turns any image into a measurable one, and editable points make corrections cheap.',
        'Property and renovation tools, insurance and inspection apps, maps without a projection, and technical drawings.',
        ['SegmentedControl', 'Field', 'Input', 'Select', 'IconButton'],
      ),
    ],
    props: [
      { name: 'src', type: 'string', description: 'The image to measure on.' },
      { name: 'alt', type: 'string', description: 'Alt text; also names the canvas.' },
      { name: 'value / defaultValue', type: 'MeasureToolMeasurement[]', description: 'Measurements, controlled or uncontrolled.' },
      { name: 'onValueChange', type: '(value: MeasureToolMeasurement[]) => void', description: 'Called when one is added, edited or removed.' },
      { name: 'defaultCalibration', type: 'MeasureToolCalibration', description: 'Scale to start with: two points, a length and a unit.' },
      { name: 'onCalibrationChange', type: '(calibration: MeasureToolCalibration) => void', description: 'Called when the scale is set.' },
      { name: 'units', type: 'string[]', defaultValue: "['mm', 'cm', 'm', 'in', 'ft']", description: 'Units offered when calibrating.' },
    ],
  },
}
