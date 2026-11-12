import './CardBox.css'
import type { Ref, MouseEventHandler } from 'react'
import { useState, useCallback } from 'react'
import type { Flashcard } from '../data/deck'
import type { CardTransition } from '../hooks/useCardTransition'
import type { Sticker as StickerType } from '../data/stickers'
import type { StickerPosition } from '../utils/stickerPlacement'
import Sticker from './Sticker'
import ParticleBurst from './ParticleBurst'

interface CardBoxProps {
  card: Flashcard
  face: 'image' | 'word'
  imageAvailable: boolean
  transition: CardTransition | null
  buttonRef: Ref<HTMLButtonElement>
  flipperRef: Ref<HTMLDivElement>
  onFlip: MouseEventHandler<HTMLButtonElement>
  onImageFailure: (card: Flashcard) => void
  activeSticker?: StickerType | null
  stickerPosition?: StickerPosition | null
  onStickerCollected?: (stickerId: string) => void
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
  activeSticker,
  stickerPosition,
  onStickerCollected,
}: CardBoxProps) {
  const [showParticles, setShowParticles] = useState(false)

  const handleStickerCentered = useCallback(() => {
    setShowParticles(true)
  }, [])

  const handleCardClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    // Don't flip if a sticker was clicked
    const target = e.target as HTMLElement
    if (target.closest('.sticker')) {
      return
    }
    onFlip(e)
  }, [onFlip])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="card-box card-main"
        aria-label={face === 'image' ? 'Show word' : 'Show picture'}
        aria-pressed={face === 'word'}
        data-transition={transition ?? undefined}
        onClick={handleCardClick}
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
        {face === 'word' && activeSticker && stickerPosition && (
          <Sticker
            sticker={activeSticker}
            position={stickerPosition}
            onPeelComplete={handleStickerCentered}
            onCollect={onStickerCollected}
          />
        )}
      </button>
      {showParticles && activeSticker && (
        <ParticleBurst 
          x={window.innerWidth / 2} 
          y={window.innerHeight / 2}
          onComplete={() => setShowParticles(false)}
        />
      )}
    </>
  )
}

export default CardBox
