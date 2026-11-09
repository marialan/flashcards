import type { Ref } from 'react'
import type { Flashcard } from '../data/deck'
import type { CardTransition } from '../hooks/useCardTransition'
import type { usePointerGesture } from '../hooks/usePointerGesture'
import CardBox from './CardBox'
import CardPreview from './CardPreview'

type PointerGestureHandlers = ReturnType<typeof usePointerGesture>
type AudioStatus = 'idle' | 'playing' | 'unavailable'

interface CardStageProps {
  card: Flashcard
  face: 'image' | 'word'
  imageAvailable: boolean
  transition: CardTransition | null
  audioStatus: AudioStatus
  cardCount: number
  previousCard: Flashcard | null
  nextCard: Flashcard | null
  unavailablePreviewIds: ReadonlySet<string>
  buttonRef: Ref<HTMLButtonElement>
  flipperRef: Ref<HTMLDivElement>
  pointerGesture: PointerGestureHandlers
  onSelectCard: (direction: -1 | 1) => void
  onFlip: () => void
  onImageFailure: (card: Flashcard) => void
  onPreviewImageFailure: (cardId: string) => void
  onReplay: () => void
}

function CardStage({
  card,
  face,
  imageAvailable,
  transition,
  audioStatus,
  cardCount,
  previousCard,
  nextCard,
  unavailablePreviewIds,
  buttonRef,
  flipperRef,
  pointerGesture,
  onSelectCard,
  onFlip,
  onImageFailure,
  onPreviewImageFailure,
  onReplay,
}: CardStageProps) {
  return (
    <div
      className={cardCount > 1 ? 'card-stage card-stage-navigable' : 'card-stage'}
      role="group"
      aria-label="Flashcard carousel"
      onPointerDown={pointerGesture.onPointerDown}
      onPointerMove={pointerGesture.onPointerMove}
      onPointerUp={pointerGesture.onPointerUp}
      onPointerCancel={pointerGesture.onPointerCancel}
      onClickCapture={pointerGesture.onClickCapture}
    >
      {previousCard && (
        <CardPreview
          card={previousCard}
          direction="previous"
          unavailable={unavailablePreviewIds.has(previousCard.card_id)}
          onSelect={() => onSelectCard(-1)}
          onImageFailure={onPreviewImageFailure}
        />
      )}
      <CardBox
        card={card}
        face={face}
        imageAvailable={imageAvailable}
        transition={transition}
        buttonRef={buttonRef}
        flipperRef={flipperRef}
        onFlip={onFlip}
        onImageFailure={onImageFailure}
      />
      {nextCard && (
        <CardPreview
          card={nextCard}
          direction="next"
          unavailable={unavailablePreviewIds.has(nextCard.card_id)}
          onSelect={() => onSelectCard(1)}
          onImageFailure={onPreviewImageFailure}
        />
      )}
      <div className="audio-controls">
        {face === 'word' && (
          <>
            <button
              type="button"
              className="audio-replay"
              data-playback-state={audioStatus}
              aria-label={audioStatus === 'unavailable' ? 'Retry word audio' : 'Play word again'}
              onClick={(event) => {
                event.stopPropagation()
                onReplay()
              }}
            >
              <span className="audio-replay-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 4V5L7 9H3Z" />
                  <path d="M16 9a5 5 0 0 1 0 6" />
                  <path d="M18.5 6.5a9 9 0 0 1 0 11" />
                </svg>
                {audioStatus === 'unavailable' && (
                  <span className="audio-warning">!</span>
                )}
              </span>
              <span>
                {audioStatus === 'playing'
                  ? 'Playing'
                  : audioStatus === 'unavailable'
                    ? 'Retry audio'
                    : 'Replay'}
              </span>
            </button>
            {audioStatus !== 'idle' && (
              <p className="audio-status" role="status">
                {audioStatus === 'unavailable'
                  ? 'Audio unavailable'
                  : 'Playing pronunciation'}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default CardStage
