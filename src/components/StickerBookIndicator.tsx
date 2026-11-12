import './StickerBookIndicator.css'

interface StickerBookIndicatorProps {
  collectedCount: number
}

function StickerBookIndicator({ collectedCount }: StickerBookIndicatorProps) {
  return (
    <div className="sticker-book-indicator">
      <span className="sticker-book-icon" aria-hidden="true">
        📒
      </span>
      <span className="sticker-book-count">{collectedCount}</span>
      <span className="visually-hidden">Stickers collected: {collectedCount}</span>
    </div>
  )
}

export default StickerBookIndicator
