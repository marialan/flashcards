import './CardBox.css'
import type { Ref, MouseEventHandler } from 'react'
import type { Flashcard } from '../data/deck'
import type { CardTransition } from '../hooks/useCardTransition'

interface CardBoxProps {
  card: Flashcard
  face: 'image' | 'word'
  imageAvailable: boolean
  transition: CardTransition | null
  buttonRef: Ref<HTMLButtonElement>
  flipperRef: Ref<HTMLDivElement>
  onFlip: MouseEventHandler<HTMLButtonElement>
  onImageFailure: (card: Flashcard) => void
}

function CardBox({
  card,
  face,
  imageAvailable,
  transition,
  buttonRef,
  flipperRef,
  onFlip,
  onImageFailure,
}: CardBoxProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="card-box card-main"
      aria-label={face === 'image' ? 'Show word' : 'Show picture'}
      aria-pressed={face === 'word'}
      data-transition={transition ?? undefined}
      onClick={onFlip}
    >
      <div
        ref={flipperRef}
        className="card-flipper"
        data-face={face}
        data-transition={transition ?? undefined}
      >
        <div className="card-face" aria-hidden={face !== 'image'}>
          {imageAvailable ? (
            <img
              key={card.card_id}
              className="card-image"
              src={new URL(card.image, document.baseURI).href}
              alt="Picture card"
              draggable={false}
              onError={() => onImageFailure(card)}
            />
          ) : (
            <div className="image-unavailable" role="status">
              <span className="unavailable-icon" aria-hidden="true">!</span>
              <span>Image unavailable</span>
            </div>
          )}
        </div>
        <div className="card-face card-word" aria-hidden={face !== 'word'}>
          {card.target_word}
        </div>
      </div>
    </button>
  )
}

export default CardBox
