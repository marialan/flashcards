export interface StickerPosition {
  x: number
  y: number
  rotation: number
}

const MAX_PLACEMENT_RETRIES = 20
const STICKER_SIZE = 60 // pixels
const MIN_WORD_DISTANCE = 20 // pixels from word boundary
const FALLBACK_POSITIONS = [
  { x: 16, y: 16 }, // top-left
  { x: -16, y: 16, anchor: 'top-right' as const }, // top-right
  { x: 16, y: -16, anchor: 'bottom-left' as const }, // bottom-left
  { x: -16, y: -16, anchor: 'bottom-right' as const }, // bottom-right
]

function getRandomRotation(): number {
  return Math.random() * 30 - 15
}

function isPositionValid(
  x: number,
  y: number,
  cardRect: DOMRect,
  wordRect: DOMRect | null,
  controlRects: DOMRect[],
): boolean {
  const stickerSize = STICKER_SIZE

  // Check card bounds (with padding)
  const cardPadding = 8
  if (
    x < cardPadding ||
    x + stickerSize > cardRect.width - cardPadding ||
    y < cardPadding ||
    y + stickerSize > cardRect.height - cardPadding
  ) {
    return false
  }

  // Check word overlap
  if (wordRect) {
    const wordLeft = wordRect.left - cardRect.left
    const wordTop = wordRect.top - cardRect.top
    const wordRight = wordLeft + wordRect.width
    const wordBottom = wordTop + wordRect.height

    const stickerRight = x + stickerSize
    const stickerBottom = y + stickerSize

    if (
      x < wordRight + MIN_WORD_DISTANCE &&
      stickerRight > wordLeft - MIN_WORD_DISTANCE &&
      y < wordBottom + MIN_WORD_DISTANCE &&
      stickerBottom > wordTop - MIN_WORD_DISTANCE
    ) {
      return false
    }
  }

  // Check control bounds
  for (const controlRect of controlRects) {
    const controlLeft = controlRect.left - cardRect.left
    const controlTop = controlRect.top - cardRect.top
    const controlRight = controlLeft + controlRect.width
    const controlBottom = controlTop + controlRect.height

    const stickerRight = x + stickerSize
    const stickerBottom = y + stickerSize

    if (
      x < controlRight + 8 &&
      stickerRight > controlLeft - 8 &&
      y < controlBottom + 8 &&
      stickerBottom > controlTop - 8
    ) {
      return false
    }
  }

  return true
}

export function calculateStickerPosition(
  cardElement: HTMLElement,
  wordElement: HTMLElement | null,
  controlElements: HTMLElement[],
): StickerPosition {
  const cardRect = cardElement.getBoundingClientRect()
  const wordRect = wordElement ? wordElement.getBoundingClientRect() : null
  const controlRects = controlElements.map((el) => el.getBoundingClientRect())

  // Try random positions
  for (let attempt = 0; attempt < MAX_PLACEMENT_RETRIES; attempt++) {
    const x = Math.random() * (cardRect.width - STICKER_SIZE)
    const y = Math.random() * (cardRect.height - STICKER_SIZE)

    if (isPositionValid(x, y, cardRect, wordRect, controlRects)) {
      return {
        x,
        y,
        rotation: getRandomRotation(),
      }
    }
  }

  // Fallback: use corner position
  const fallback = FALLBACK_POSITIONS[0]
  return {
    x: fallback.x,
    y: fallback.y,
    rotation: getRandomRotation(),
  }
}
