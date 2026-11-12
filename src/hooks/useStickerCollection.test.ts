import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStickerCollection } from './useStickerCollection'

describe('useStickerCollection', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('initializes with empty collection', () => {
    const { result } = renderHook(() => useStickerCollection(null))
    expect(result.current.collectedIds.size).toBe(0)
    expect(result.current.flipsSinceLastSticker).toBe(0)
  })

  it('marks a sticker as collected', () => {
    const { result } = renderHook(() => useStickerCollection(null))

    act(() => {
      result.current.markStickerCollected('sticker-1')
    })

    expect(result.current.collectedIds.has('sticker-1')).toBe(true)
  })

  it('resets flips counter', () => {
    const { result } = renderHook(() => useStickerCollection(null))

    act(() => {
      result.current.incrementFlipsCounter()
      result.current.incrementFlipsCounter()
    })

    expect(result.current.flipsSinceLastSticker).toBe(2)

    act(() => {
      result.current.resetFlipsCounter()
    })

    expect(result.current.flipsSinceLastSticker).toBe(0)
  })

  it('increments flips counter', () => {
    const { result } = renderHook(() => useStickerCollection(null))

    act(() => {
      result.current.incrementFlipsCounter()
    })

    expect(result.current.flipsSinceLastSticker).toBe(1)
  })

  it('prevents duplicate collection', () => {
    const { result } = renderHook(() => useStickerCollection(null))

    act(() => {
      result.current.markStickerCollected('sticker-1')
      result.current.markStickerCollected('sticker-1')
    })

    expect(result.current.collectedIds.size).toBe(1)
  })

  it('checks if all stickers are collected', () => {
    const { result } = renderHook(() => useStickerCollection(null))

    expect(result.current.hasAllStickersCollected(3)).toBe(false)

    act(() => {
      result.current.markStickerCollected('sticker-1')
      result.current.markStickerCollected('sticker-2')
      result.current.markStickerCollected('sticker-3')
    })

    expect(result.current.hasAllStickersCollected(3)).toBe(true)
  })

  it('persists collection to localStorage', () => {
    const storageKey = 'test-key'
    const { result } = renderHook(() => useStickerCollection(storageKey))

    act(() => {
      result.current.markStickerCollected('sticker-1')
    })

    const saved = localStorage.getItem(storageKey)
    expect(saved).toBeDefined()
    const parsed = JSON.parse(saved!)
    expect(parsed.collectedStickerIds).toContain('sticker-1')
  })

  it('loads collection from localStorage', () => {
    const storageKey = 'test-key'
    const savedState = {
      schema_version: 1,
      collectedStickerIds: ['sticker-1', 'sticker-2'],
      flipsSinceLastSticker: 5,
    }
    localStorage.setItem(storageKey, JSON.stringify(savedState))

    const { result } = renderHook(() => useStickerCollection(storageKey))

    expect(result.current.collectedIds.has('sticker-1')).toBe(true)
    expect(result.current.collectedIds.has('sticker-2')).toBe(true)
    expect(result.current.flipsSinceLastSticker).toBe(5)
  })

  it('handles missing storage key gracefully', () => {
    const { result } = renderHook(() => useStickerCollection(null))

    act(() => {
      result.current.markStickerCollected('sticker-1')
      result.current.incrementFlipsCounter()
    })

    // Should not throw and state should work without persistence
    expect(result.current.collectedIds.has('sticker-1')).toBe(true)
    expect(result.current.flipsSinceLastSticker).toBe(1)
  })
})
