'use client'

import { useCallback, useEffect, useState, type RefObject } from 'react'

export type PopoverPlacement = 'top' | 'bottom' | 'left' | 'right'
export type PopoverAlign = 'start' | 'center' | 'end'

export interface PopoverPosition {
  top: number
  left: number
  placement: PopoverPlacement
}

/**
 * Minimal anchored positioning: measure the anchor and the floating element,
 * place it on the requested side, then flip to the opposite side if it would
 * leave the viewport, and finally clamp along the cross axis.
 *
 * Deliberately dependency-free. A full positioning engine is a lot of bytes
 * for behaviour this library only needs in one shape.
 */
export function usePopoverPosition(
  anchorRef: RefObject<HTMLElement>,
  floatingRef: RefObject<HTMLElement>,
  open: boolean,
  placement: PopoverPlacement,
  align: PopoverAlign,
  offset: number,
): PopoverPosition | null {
  const [position, setPosition] = useState<PopoverPosition | null>(null)

  const update = useCallback(() => {
    const anchor = anchorRef.current
    const floating = floatingRef.current
    if (!anchor || !floating) return

    const a = anchor.getBoundingClientRect()
    const f = floating.getBoundingClientRect()
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight

    const room = {
      top: a.top,
      bottom: vh - a.bottom,
      left: a.left,
      right: vw - a.right,
    }
    const needed = placement === 'top' || placement === 'bottom' ? f.height : f.width
    const opposite: Record<PopoverPlacement, PopoverPlacement> = {
      top: 'bottom',
      bottom: 'top',
      left: 'right',
      right: 'left',
    }

    let resolved = placement
    if (room[placement] < needed + offset + margin && room[opposite[placement]] > room[placement]) {
      resolved = opposite[placement]
    }

    let top = 0
    let left = 0

    if (resolved === 'bottom' || resolved === 'top') {
      top = resolved === 'bottom' ? a.bottom + offset : a.top - f.height - offset
      left =
        align === 'start' ? a.left : align === 'end' ? a.right - f.width : a.left + (a.width - f.width) / 2
    } else {
      left = resolved === 'right' ? a.right + offset : a.left - f.width - offset
      top =
        align === 'start' ? a.top : align === 'end' ? a.bottom - f.height : a.top + (a.height - f.height) / 2
    }

    left = Math.min(Math.max(margin, left), vw - f.width - margin)
    top = Math.min(Math.max(margin, top), vh - f.height - margin)

    setPosition({ top, left, placement: resolved })
  }, [anchorRef, floatingRef, placement, align, offset])

  useEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, update])

  return position
}
