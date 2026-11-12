import { useCallback, useState } from 'react'
import type { StickerCollectionState } from '../data/stickers'
import { readStickerCollection, saveStickerCollection } from '../progress/progress'

interface UseStickerCollectionResult {
  collectedIds: ReadonlySet<string>
  flipsSinceLastSticker: number
  markStickerCollected: (stickerId: string) => void
  resetFlipsCounter: () => void
  incrementFlipsCounter: () => void
  hasAllStickersCollected: (totalStickers: number) => boolean
}

export function useStickerCollection(
  storageKey: string | null,
): UseStickerCollectionResult {
  const [state, setState] = useState<StickerCollectionState>(() => {
    if (!storageKey) {
      return {
        collectedStickerIds: [],
        flipsSinceLastSticker: 0,
      }
    }

    const saved = readStickerCollection(storageKey)
    if (saved) {
      return {
        collectedStickerIds: saved.collectedStickerIds,
        flipsSinceLastSticker: saved.flipsSinceLastSticker,
      }
    }

    return {
      collectedStickerIds: [],
      flipsSinceLastSticker: 0,
    }
  })

  const markStickerCollected = useCallback(
    (stickerId: string) => {
      setState((prev) => {
        const existing = prev.collectedStickerIds.includes(stickerId)
        if (existing) {
          return prev
        }

        const updated: StickerCollectionState = {
          collectedStickerIds: [...prev.collectedStickerIds, stickerId],
          flipsSinceLastSticker: 0,
        }

        if (storageKey) {
          saveStickerCollection(storageKey, updated.collectedStickerIds, updated.flipsSinceLastSticker)
        }

        return updated
      })
    },
    [storageKey],
  )

  const resetFlipsCounter = useCallback(() => {
    setState((prev) => {
      const updated: StickerCollectionState = {
        ...prev,
        flipsSinceLastSticker: 0,
      }

      if (storageKey) {
        saveStickerCollection(storageKey, updated.collectedStickerIds, updated.flipsSinceLastSticker)
      }

      return updated
    })
  }, [storageKey])

  const incrementFlipsCounter = useCallback(() => {
    setState((prev) => {
      const updated: StickerCollectionState = {
        ...prev,
        flipsSinceLastSticker: prev.flipsSinceLastSticker + 1,
      }

      if (storageKey) {
        saveStickerCollection(storageKey, updated.collectedStickerIds, updated.flipsSinceLastSticker)
      }

      return updated
    })
  }, [storageKey])

  const hasAllStickersCollected = useCallback(
    (totalStickers: number) => state.collectedStickerIds.length >= totalStickers,
    [state.collectedStickerIds.length],
  )

  return {
    collectedIds: new Set(state.collectedStickerIds),
    flipsSinceLastSticker: state.flipsSinceLastSticker,
    markStickerCollected,
    resetFlipsCounter,
    incrementFlipsCounter,
    hasAllStickersCollected,
  }
}
