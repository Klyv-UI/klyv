/**
 * Measuring the page while it is under load.
 *
 * Every number here is taken from this browser, on this machine, now. That is
 * the point — a library quoting its own benchmark from someone else's laptop
 * is quoting a press release — and it is also the limit, which the page says
 * out loud: a development build is slower than the one a consumer ships, and a
 * machine that is busy will read as a machine that is slow.
 */

export interface FrameReport {
  /** Frames seen per second over the sample. */
  fps: number
  /** Median frame, in milliseconds. */
  median: number
  /** The slow tail: 95% of frames were faster than this. */
  p95: number
  /** Frames that took longer than two 60Hz budgets. */
  janky: number
  /** Every frame duration, for the chart. */
  frames: number[]
}

/**
 * Watch the frame clock for a while.
 *
 * Resolves with what the browser actually managed, not with what it was asked
 * for: the first frame is dropped because it carries the work that started the
 * sample rather than the steady state being measured.
 */
export function sampleFrames(milliseconds: number): Promise<FrameReport> {
  return new Promise((resolve) => {
    const durations: number[] = []
    let last = performance.now()
    const started = last
    let first = true

    const tick = (now: number) => {
      const delta = now - last
      last = now
      if (first) first = false
      else durations.push(delta)

      if (now - started < milliseconds) {
        requestAnimationFrame(tick)
        return
      }
      resolve(report(durations))
    }
    requestAnimationFrame(tick)
  })
}

function report(durations: number[]): FrameReport {
  if (durations.length === 0) return { fps: 0, median: 0, p95: 0, janky: 0, frames: [] }
  const sorted = [...durations].sort((a, b) => a - b)
  const total = durations.reduce((sum, value) => sum + value, 0)
  return {
    fps: Math.round((durations.length / total) * 1000),
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1],
    janky: durations.filter((duration) => duration > 33.4).length,
    frames: durations,
  }
}

/** Wait for the browser to have painted what was just rendered. */
export function afterPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

/** Rough heap use, where the browser offers it. Chrome only, and that is fine. */
export function heapMB(): number | null {
  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
  return memory ? Math.round((memory.usedJSHeapSize / 1024 / 1024) * 10) / 10 : null
}
