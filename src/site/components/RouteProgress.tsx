import { useEffect, useRef, useState } from 'react'
import { useNavigation } from 'react-router-dom'
import { cn } from 'klyvui'

type Phase = 'idle' | 'loading' | 'done'

/** A navigation faster than this never shows the bar at all, so quick hops do not flicker. */
const DELAY_MS = 150

/**
 * A thin accent bar across the top of the window while the next page loads.
 *
 * Routes are lazy at the router level, so the page you are on stays visible
 * until the next one is ready; this bar is what says something is happening
 * in the meantime. It eases most of the way across, finishes when the page
 * lands, then fades — and under reduced motion it simply appears full and
 * fades, with no travel.
 *
 * It reads the navigation state itself, so nothing else in the shell
 * re-renders when a navigation starts or ends.
 */
export function RouteProgress() {
  const navigation = useNavigation()
  const busy = navigation.state !== 'idle'
  const [phase, setPhase] = useState<Phase>('idle')
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    if (busy) {
      const timer = window.setTimeout(() => setPhase('loading'), DELAY_MS)
      return () => window.clearTimeout(timer)
    }
    if (phaseRef.current === 'idle') return
    setPhase('done')
    const timer = window.setTimeout(() => setPhase('idle'), 450)
    return () => window.clearTimeout(timer)
  }, [busy])

  return (
    <>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none fixed inset-x-0 top-0 z-[70] h-[2.5px]',
          phase === 'loading' && 'opacity-100',
          phase === 'done' && 'opacity-0 transition-opacity delay-150 duration-300',
          phase === 'idle' && 'opacity-0',
        )}
      >
        <div
          className={cn(
            'h-full origin-left rounded-r-full bg-accent-strong',
            phase === 'idle' && 'scale-x-0',
            phase === 'loading' &&
              'scale-x-[0.85] transition-transform duration-[5000ms] ease-out motion-reduce:scale-x-100 motion-reduce:transition-none',
            phase === 'done' && 'scale-x-100 transition-transform duration-200 ease-out motion-reduce:transition-none',
          )}
        />
      </div>
      <span role="status" className="sr-only">
        {phase === 'loading' ? 'Loading page' : ''}
      </span>
    </>
  )
}
