import type { Flashcard } from '../data/deck'

interface CardPreviewProps {
  card: Flashcard
  direction: 'previous' | 'next'
  unavailable: boolean
  onSelect: () => void
  onImageFailure: (cardId: string) => void
}

function CardPreview({
  card,
  direction,
  unavailable,
  onSelect,
  onImageFailure,
}: CardPreviewProps) {
  const label = direction === 'previous' ? 'Previous card' : 'Next card'

  return (
    <button
      type="button"
      className="card-preview"
      aria-label={label}
      onClick={onSelect}
    >
      {unavailable ? (
        <span className="card-preview-placeholder" aria-hidden="true">!</span>
      ) : (
        <img
          className="card-preview-image"
          src={new URL(card.image, document.baseURI).href}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() => onImageFailure(card.card_id)}
        />
      )}
    </button>
  )
}

export default CardPreview
