import { useEffect, useLayoutEffect } from 'react'

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * Neither runs during a server render, but React logs a warning for every
 * `useLayoutEffect` it meets there. A component that measures before paint
 * wants the layout effect on the client and silence on the server.
 */
export const useIsomorphicLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect
