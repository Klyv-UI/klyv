import { Skeleton } from 'klyvui'

/**
 * Stands in for a documentation page while its code or data arrives.
 *
 * It is the page's own shape — an intro closed on a hairline, then sections
 * with a heading, a line of description and a frame — so when the real page
 * lands nothing jumps, and a reader sees where content is coming rather than
 * an empty column. The library's Skeleton pulses only when motion is allowed.
 * The container is marked busy, and says so once to assistive technology.
 */
export function PageSkeleton({ frame = 220 }: { frame?: number }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-12">
      <span role="status" className="sr-only">
        Loading page
      </span>

      <div className="flex flex-col gap-4 border-b border-line pb-8">
        <Skeleton width={96} />
        <Skeleton height={32} width="min(360px, 70%)" className="rounded-[10px]" />
        <Skeleton lines={2} width="min(620px, 100%)" />
        <div className="flex gap-8 pt-1">
          {[56, 64, 48].map((width) => (
            <div key={width} className="flex flex-col gap-1.5">
              <Skeleton height={18} width={width} />
              <Skeleton width={width + 24} />
            </div>
          ))}
        </div>
      </div>

      {[frame, 160].map((height, index) => (
        <div key={index} className="flex flex-col gap-4">
          <Skeleton height={16} width={index === 0 ? 150 : 110} />
          <Skeleton width="min(520px, 80%)" />
          <Skeleton shape="rect" height={height} className="w-full rounded-[var(--radius-card)]" />
        </div>
      ))}
    </div>
  )
}
