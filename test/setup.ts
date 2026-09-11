/**
 * The browser APIs jsdom does not implement, stubbed just far enough for the
 * components to mount. None of these pretend to *work* — a canvas returns no
 * context, an observer reports everything as visible — because the suite is
 * auditing the accessibility tree, not drawing or measuring anything.
 */
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia

class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= StubResizeObserver as unknown as typeof ResizeObserver

// Everything is "on screen", so content gated behind an entrance renders.
class StubIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target, intersectionRatio: 1 } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
globalThis.IntersectionObserver ??= StubIntersectionObserver as unknown as typeof IntersectionObserver

// jsdom logs "not implemented" for every canvas; returning null is what a
// browser without canvas support does, and the components already guard it.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext

window.scrollTo = () => {}
Element.prototype.scrollIntoView = () => {}
Element.prototype.scrollTo = () => {}
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: async () => {}, readText: async () => '' },
  configurable: true,
})
