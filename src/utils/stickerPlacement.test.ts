import { describe, it, expect, beforeEach } from 'vitest'
import { calculateStickerPosition } from './stickerPlacement'

describe('stickerPlacement', () => {
  let cardElement: HTMLElement
  let wordElement: HTMLElement
  let controlElement: HTMLElement

  beforeEach(() => {
    // Create mock DOM elements with getBoundingClientRect
    cardElement = document.createElement('div')
    cardElement.className = 'card-main'
    Object.defineProperty(cardElement, 'getBoundingClientRect', {
      value: () => ({
        top: 0,
        left: 0,
        width: 320,
        height: 400,
        right: 320,
        bottom: 400,
      }),
    })

    wordElement = document.createElement('div')
    wordElement.className = 'card-word'
    Object.defineProperty(wordElement, 'getBoundingClientRect', {
      value: () => ({
        top: 180,
        left: 60,
        width: 200,
        height: 40,
        right: 260,
        bottom: 220,
      }),
    })

    controlElement = document.createElement('button')
    Object.defineProperty(controlElement, 'getBoundingClientRect', {
      value: () => ({
        top: 350,
        left: 140,
        width: 40,
        height: 40,
        right: 180,
        bottom: 390,
      }),
    })
  })

  describe('calculateStickerPosition', () => {
    it('returns a valid position within card bounds', () => {
      const position = calculateStickerPosition(cardElement, wordElement, [controlElement])
      expect(position.x).toBeGreaterThanOrEqual(8)
      expect(position.x + 60).toBeLessThanOrEqual(320 - 8)
      expect(position.y).toBeGreaterThanOrEqual(8)
      expect(position.y + 60).toBeLessThanOrEqual(400 - 8)
    })

    it('returns a rotation between -15 and 15 degrees', () => {
      const position = calculateStickerPosition(cardElement, wordElement, [controlElement])
      expect(position.rotation).toBeGreaterThanOrEqual(-15)
      expect(position.rotation).toBeLessThanOrEqual(15)
    })

    it('avoids word element bounds', () => {
      // Word is at (60, 180) with size (200, 40)
      // Sticker should not overlap this area +20px buffer
      const position = calculateStickerPosition(cardElement, wordElement, [controlElement])
      const wordLeft = 60 - 20
      const wordRight = 260 + 20
      const wordTop = 180 - 20
      const wordBottom = 220 + 20

      const stickerRight = position.x + 60
      const stickerBottom = position.y + 60

      // Either sticker is to the left, right, above, or below the word area
      const doesNotOverlap = 
        stickerRight < wordLeft || 
        position.x > wordRight || 
        stickerBottom < wordTop || 
        position.y > wordBottom

      expect(doesNotOverlap).toBe(true)
    })

    it('avoids control element bounds', () => {
      // Control is at (140, 350) with size (40, 40)
      const position = calculateStickerPosition(cardElement, wordElement, [controlElement])
      const controlLeft = 140 - 8
      const controlRight = 180 + 8
      const controlTop = 350 - 8
      const controlBottom = 390 + 8

      const stickerRight = position.x + 60
      const stickerBottom = position.y + 60

      const doesNotOverlap = 
        stickerRight < controlLeft || 
        position.x > controlRight || 
        stickerBottom < controlTop || 
        position.y > controlBottom

      expect(doesNotOverlap).toBe(true)
    })

    it('handles null word element', () => {
      const position = calculateStickerPosition(cardElement, null, [controlElement])
      expect(position).toBeDefined()
      expect(position.x).toBeGreaterThanOrEqual(8)
      expect(position.y).toBeGreaterThanOrEqual(8)
    })

    it('handles empty control list', () => {
      const position = calculateStickerPosition(cardElement, wordElement, [])
      expect(position).toBeDefined()
      expect(position.x).toBeGreaterThanOrEqual(8)
      expect(position.y).toBeGreaterThanOrEqual(8)
    })
  })
})
