// Throwaway: does every shipped preset's ink clear 4.5 on BOTH accent and
// strong, and does the guarantee survive a full hue sweep?
import ts from 'typescript'
import { readFileSync } from 'node:fs'

async function load(path) {
  const source = readFileSync(path, 'utf8')
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText
  // Rewrite the relative import so the data URL can resolve it.
  const rewritten = js.replace(
    /from ['"]\.\.\/lib\/contrast['"]/g,
    `from '${new URL('./src/lib/contrast.ts', import.meta.url)}'`,
  )
  return import(`data:text/javascript;base64,${Buffer.from(rewritten).toString('base64')}`)
}

const contrast = await load('./src/lib/contrast.ts')
const accentSource = readFileSync('./src/theme/accent.ts', 'utf8')
const js = ts.transpileModule(accentSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const stub = js
  .replace(/from ['"]\.\.\/lib\/contrast['"]/g, `from '${new URL('./src/lib/contrast.ts', import.meta.url)}'`)
  .replace(/^'use client'$/m, '')
const theme = await import(`data:text/javascript;base64,${Buffer.from(stub).toString('base64')}`)

const { deriveAccent, ACCENT_PRESETS } = theme
const { contrastRatio } = contrast

let worstPreset = Infinity
console.log('preset            accent    strong    ink       on-accent  on-strong')
for (const preset of ACCENT_PRESETS) {
  const f = deriveAccent(preset.hex)
  const a = contrastRatio(f.ink, f.accent)
  const s = contrastRatio(f.ink, f.strong)
  worstPreset = Math.min(worstPreset, a, s)
  const flag = Math.min(a, s) >= 4.5 ? '' : '   <-- FAILS'
  console.log(
    `${preset.name.padEnd(17)} ${f.accent}   ${f.strong}   ${f.ink}   ${a.toFixed(2).padEnd(10)} ${s.toFixed(2)}${flag}`,
  )
}
console.log(`\nworst across shipped presets: ${worstPreset.toFixed(2)}`)

// Full sweep: every hue, a range of saturations and lightnesses.
let worst = { ratio: Infinity, hex: null }
let failures = 0
let total = 0
const hsl = (h, s, l) => {
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return `#${[f(0), f(8), f(4)]
    .map((v) => Math.round(v * 255).toString(16).padStart(2, '0'))
    .join('')}`
}
for (let h = 0; h < 360; h += 5) {
  for (let s = 0.2; s <= 1.0001; s += 0.1) {
    for (let l = 0.15; l <= 0.9001; l += 0.05) {
      const hex = hsl(h, s, l)
      const f = deriveAccent(hex)
      const ratio = Math.min(contrastRatio(f.ink, f.accent), contrastRatio(f.ink, f.strong))
      total += 1
      if (ratio < 4.5) failures += 1
      if (ratio < worst.ratio) worst = { ratio, hex, family: f }
    }
  }
}
console.log(`\nhue sweep: ${total} colours, ${failures} below 4.5 (${((failures / total) * 100).toFixed(2)}%)`)
console.log(`worst: ${worst.ratio.toFixed(2)} at ${worst.hex} -> ink ${worst.family.ink}, strong ${worst.family.strong}`)
