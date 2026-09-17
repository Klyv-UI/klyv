/**
 * The screen shown before the site has anything to show.
 *
 * `index.html` paints exactly this markup inside #root before any script
 * runs, and styles it with its own inline <style> — the stylesheet may not be
 * there yet. The router renders this component while the first page's code
 * loads, so the hand-off from the inline splash to React is invisible: the
 * same mark in the same place, until the page replaces it.
 */
export function BootScreen() {
  return (
    <div className="boot" role="status" aria-label="Loading Klyv">
      <span className="boot-mark" aria-hidden="true">
        C
      </span>
      <span className="boot-track" aria-hidden="true">
        <span className="boot-fill" />
      </span>
    </div>
  )
}
