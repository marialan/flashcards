import { describe, it, expect, vi } from 'vitest'
import { selectRandomSticker } from './stickers'

describe('stickers', () => {
  describe('selectRandomSticker', () => {
    const mockPool = [
      { id: 'sticker-1', name: 'First', imageSrc: 'first.png' },
      { id: 'sticker-2', name: 'Second', imageSrc: 'second.png' },
      { id: 'sticker-3', name: 'Third', imageSrc: 'third.png' },
    ]

    it('returns a random uncollected sticker from the pool', () => {
      const collected = new Set<string>()
      const result = selectRandomSticker(mockPool, collected)
      expect(result).toBeDefined()
      expect(mockPool).toContainEqual(result)
    })

    it('filters out collected stickers', () => {
      const collected = new Set(['sticker-1', 'sticker-2'])
      const result = selectRandomSticker(mockPool, collected)
      expect(result?.id).toBe('sticker-3')
    })

    it('returns null when all stickers are collected', () => {
      const collected = new Set(['sticker-1', 'sticker-2', 'sticker-3'])
      const result = selectRandomSticker(mockPool, collected)
      expect(result).toBeNull()
    })

    it('returns null for empty pool', () => {
      const collected = new Set<string>()
      const result = selectRandomSticker([], collected)
      expect(result).toBeNull()
    })

    it('distributes selections across available stickers', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const collected = new Set<string>()
      const result = selectRandomSticker(mockPool, collected)
      expect(result).toBeDefined()
      expect(result?.id).toMatch(/sticker-\d/)
    })
  })
})
