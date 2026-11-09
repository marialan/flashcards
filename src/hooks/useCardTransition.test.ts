import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCardTransition } from './useCardTransition'

describe('useCardTransition', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('locks while a transition is active and unlocks after the safety timeout', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCardTransition())

    act(() => result.current.beginTransition('flip'))

    expect(result.current.transition).toBe('flip')
    expect(result.current.isTransitionLocked()).toBe(true)

    act(() => vi.advanceTimersByTime(300))

    expect(result.current.transition).toBeNull()
    expect(result.current.isTransitionLocked()).toBe(false)
  })

  it('clears the active lock and marker when reset', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCardTransition())

    act(() => result.current.beginTransition('next'))
    act(() => result.current.resetTransition())

    expect(result.current.transition).toBeNull()
    expect(result.current.isTransitionLocked()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not set a transition or lock when reduced motion is enabled', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const { result } = renderHook(() => useCardTransition())

    act(() => result.current.beginTransition('previous'))

    expect(result.current.transition).toBeNull()
    expect(result.current.isTransitionLocked()).toBe(false)
  })
})
