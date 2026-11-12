import type { Sticker } from '../data/stickers'
import { loadStickerPool, selectRandomSticker } from '../data/stickers'

interface UseStickerSpawnOptions {
  collectedIds: ReadonlySet<string>
  flipsSinceLastSticker: number
  onResetFlips: () => void
  onIncrementFlips: () => void
  totalStickersInPool: number
}

interface UseStickerSpawnResult {
  shouldSpawn: boolean
  selectedSticker: Sticker | null
  stickerPoolLoaded: boolean
  stickerPool: Sticker[]
}

const SPAWN_PROBABILITY = 0.05
const GUARANTEED_DROP_THRESHOLD = 10

export function useStickerSpawn(
  options: UseStickerSpawnOptions,
): UseStickerSpawnResult {
  const { collectedIds, flipsSinceLastSticker, totalStickersInPool } = options

  // Check if all stickers are collected
  const allCollected = collectedIds.size >= totalStickersInPool

  // Determine spawn probability
  const willSpawn = flipsSinceLastSticker >= GUARANTEED_DROP_THRESHOLD 
    ? true 
    : !allCollected && Math.random() < SPAWN_PROBABILITY

  // For now, return placeholder. Will be integrated with actual pool loading
  return {
    shouldSpawn: willSpawn,
    selectedSticker: null,
    stickerPoolLoaded: false,
    stickerPool: [],
  }
}

export async function getSpawnedSticker(
  shouldSpawn: boolean,
  collectedIds: ReadonlySet<string>,
): Promise<Sticker | null> {
  if (!shouldSpawn) {
    return null
  }

  const pool = await loadStickerPool()
  if (pool.length === 0) {
    return null
  }

  return selectRandomSticker(pool, collectedIds)
}
