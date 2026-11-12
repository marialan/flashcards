export interface Sticker {
  id: string
  name: string
  imageSrc: string
}

export interface StickerCollectionState {
  collectedStickerIds: string[]
  flipsSinceLastSticker: number
}

let stickerPoolCache: Sticker[] | null = null

export async function loadStickerPool(): Promise<Sticker[]> {
  if (stickerPoolCache) {
    return stickerPoolCache
  }

  try {
    const response = await fetch(new URL('lang/english/stickers.json', document.baseURI).href)
    if (!response.ok) {
      throw new Error(`Failed to load sticker pool: ${response.status}`)
    }
    const data = await response.json()
    stickerPoolCache = data as Sticker[]
    return stickerPoolCache
  } catch (error) {
    console.error('Sticker pool loading failed:', error)
    return []
  }
}

export function selectRandomSticker(
  pool: Sticker[],
  collectedIds: ReadonlySet<string>,
): Sticker | null {
  const available = pool.filter((sticker) => !collectedIds.has(sticker.id))
  if (available.length === 0) {
    return null
  }
  return available[Math.floor(Math.random() * available.length)]
}
