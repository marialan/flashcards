import { useCallback, useEffect, useRef, useState } from 'react'

export type CardTransition = 'flip' | 'next' | 'previous'

export function useCardTransition() {
  const [transition, setTransition] = useState<CardTransition | null>(null)
  const transitionLockedRef = useRef(false)
  const visualTransitionRef = useRef<CardTransition | null>(null)
  const transitionTimeoutRef = useRef<number | null>(null)
  const cardBoxRef = useRef<HTMLButtonElement | null>(null)
  const cardFlipperRef = useRef<HTMLDivElement | null>(null)

  const finishTransition = useCallback(() => {
    transitionLockedRef.current = false
    visualTransitionRef.current = null
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current)
      transitionTimeoutRef.current = null
    }
    setTransition(null)
  }, [])

  const handleCardTransitionEnd = useCallback((event: Event) => {
    if (
      event.target === cardFlipperRef.current &&
      visualTransitionRef.current === 'flip' &&
      (event as TransitionEvent).propertyName === 'transform'
    ) {
      finishTransition()
    }
  }, [finishTransition])

  const handleCardTransitionCancel = useCallback((event: Event) => {
    if (
      event.target === cardFlipperRef.current &&
      visualTransitionRef.current === 'flip'
    ) {
      finishTransition()
    }
  }, [finishTransition])

  const handleCardAnimationEnd = useCallback((event: Event) => {
    if (
      event.target === cardBoxRef.current &&
      visualTransitionRef.current !== null &&
      visualTransitionRef.current !== 'flip'
    ) {
      finishTransition()
    }
  }, [finishTransition])

  const handleCardAnimationCancel = useCallback((event: Event) => {
    if (
      event.target === cardBoxRef.current &&
      visualTransitionRef.current !== null &&
      visualTransitionRef.current !== 'flip'
    ) {
      finishTransition()
    }
  }, [finishTransition])

  const attachCardBox = useCallback((element: HTMLButtonElement | null) => {
    const previous = cardBoxRef.current
    if (previous) {
      previous.removeEventListener('transitionend', handleCardTransitionEnd)
      previous.removeEventListener('transitioncancel', handleCardTransitionCancel)
      previous.removeEventListener('animationend', handleCardAnimationEnd)
      previous.removeEventListener('animationcancel', handleCardAnimationCancel)
    }
    cardBoxRef.current = element
    if (element) {
      element.addEventListener('transitionend', handleCardTransitionEnd)
      element.addEventListener('transitioncancel', handleCardTransitionCancel)
      element.addEventListener('animationend', handleCardAnimationEnd)
      element.addEventListener('animationcancel', handleCardAnimationCancel)
    }
  }, [
    handleCardAnimationCancel,
    handleCardAnimationEnd,
    handleCardTransitionCancel,
    handleCardTransitionEnd,
  ])

  const beginTransition = useCallback((nextTransition: CardTransition) => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    transitionLockedRef.current = true
    visualTransitionRef.current = nextTransition
    setTransition(nextTransition)
    transitionTimeoutRef.current = window.setTimeout(finishTransition, 300)
  }, [finishTransition])

  const isTransitionLocked = useCallback(
    () => transitionLockedRef.current,
    [],
  )

  const resetTransition = useCallback(() => {
    transitionLockedRef.current = false
    visualTransitionRef.current = null
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current)
      transitionTimeoutRef.current = null
    }
    setTransition(null)
  }, [])

  useEffect(
    () => () => {
      transitionLockedRef.current = false
      visualTransitionRef.current = null
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current)
      }
    },
    [],
  )

  return {
    attachCardBox,
    beginTransition,
    cardFlipperRef,
    isTransitionLocked,
    resetTransition,
    transition,
  }
}

export default useCardTransition
