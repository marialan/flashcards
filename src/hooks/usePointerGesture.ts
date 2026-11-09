import { useCallback, useEffect, useRef } from 'react'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'

interface PointerGesture {
  pointerId: number
  startX: number
  startY: number
  maxTravel: number
}

type Direction = -1 | 1
type GestureStatus = 'loading' | 'ready' | 'unavailable'

interface UsePointerGestureOptions {
  status: GestureStatus
  canStart: () => boolean
  onSwipe: (direction: Direction) => void
}

export function usePointerGesture({ status, canStart, onSwipe }: UsePointerGestureOptions) {
  const gestureRef = useRef<PointerGesture | null>(null)
  const suppressClickRef = useRef(false)

  const reset = useCallback(() => {
    gestureRef.current = null
    suppressClickRef.current = false
  }, [])

  useEffect(() => {
    reset()
  }, [reset, status])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canStart()) return
    if (gestureRef.current) {
      gestureRef.current = null
      suppressClickRef.current = true
      return
    }
    if (!event.isPrimary || event.button !== 0) return

    suppressClickRef.current = false
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      maxTravel: 0,
    }

    const captureTarget =
      event.target instanceof Element
        ? event.target.closest('button') ?? event.currentTarget
        : event.currentTarget
    captureTarget.setPointerCapture?.(event.pointerId)
  }, [canStart])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    gesture.maxTravel = Math.max(
      gesture.maxTravel,
      Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY),
    )
  }, [])

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    onPointerMove(event)
    gestureRef.current = null
    if (gesture.maxTravel <= 10) return

    suppressClickRef.current = true
    const horizontalTravel = event.clientX - gesture.startX
    const verticalTravel = event.clientY - gesture.startY
    if (Math.abs(horizontalTravel) >= 40 && Math.abs(horizontalTravel) > Math.abs(verticalTravel)) {
      onSwipe(horizontalTravel < 0 ? 1 : -1)
    }
  }, [onPointerMove, onSwipe])

  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    suppressClickRef.current = true
  }, [])

  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current || event.detail === 0) return
    suppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }, [])

  return {
    onClickCapture,
    onPointerCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}

export default usePointerGesture
