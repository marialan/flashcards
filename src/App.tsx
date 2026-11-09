import './App.css'
import {
  useCallback,
  useState,
} from 'react'
import type { Flashcard } from './data/deck'
import type { LoadedDeck } from './data/loadDeck'
import { useAudioController } from './hooks/useAudioController'
import { useCardTransition } from './hooks/useCardTransition'
import { useDeckLoading } from './hooks/useDeckLoading'
import { usePointerGesture } from './hooks/usePointerGesture'
import { saveProgress } from './progress/progress'

interface AppProps {
  deckUrl?: string
  language?: string
}

function reportImageFailure(card: Flashcard) {
  console.error('Flashcard image unavailable.', {
    category: 'image',
    cardId: card.card_id,
    asset: card.image,
  })
}

function getOrderedCard(deck: LoadedDeck['deck'], index: number): Flashcard {
  const cardId = deck.card_order[index]
  const card = deck.cards.find(({ card_id }) => card_id === cardId)
  if (!card) throw new Error(`Ordered card "${cardId}" is missing from the deck.`)
  return card
}

function App({ deckUrl, language }: AppProps = {}) {
  const { audioStatus, playPronunciation, resetAudio, stopAudio } = useAudioController()
  const {
    attachCardBox,
    beginTransition,
    cardFlipperRef,
    isTransitionLocked,
    resetTransition,
    transition,
  } = useCardTransition()
  const [unavailablePreviewIds, setUnavailablePreviewIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const resetLoadingUi = useCallback(() => {
    setUnavailablePreviewIds(new Set())
  }, [])
  const { state, retry, updateReadyState } = useDeckLoading({
    deckUrl,
    language,
    resetAudio,
    resetTransition,
    onLoadingStart: resetLoadingUi,
    onInitialImageFailure: reportImageFailure,
  })

  function toggleFace() {
    if (state.status !== 'ready' || isTransitionLocked()) return
    const card = state.currentCard
    beginTransition('flip')

    if (state.face === 'word') {
      saveProgress(state.progressKey, card.card_id, 'image')
      stopAudio()
      updateReadyState((current) => ({ ...current, face: 'image' }))
      return
    }

    saveProgress(state.progressKey, card.card_id, 'word')
    updateReadyState((current) => ({ ...current, face: 'word' }))
    playPronunciation(card)
  }

  function navigate(direction: -1 | 1) {
    if (state.status !== 'ready' || isTransitionLocked()) return

    const cardCount = state.result.deck.card_order.length
    if (cardCount < 2) return

    const currentIndex = state.result.deck.card_order.indexOf(state.currentCard.card_id)
    const nextIndex = (currentIndex + direction + cardCount) % cardCount
    const nextCard = getOrderedCard(state.result.deck, nextIndex)
    beginTransition(direction > 0 ? 'next' : 'previous')
    resetAudio()
    saveProgress(state.progressKey, nextCard.card_id, 'image')
    updateReadyState((current) => ({
      ...current,
      currentCard: nextCard,
      imageAvailable: true,
      face: 'image',
    }))
    }

    const canStartPointerGesture = useCallback(
      () => state.status === 'ready' && !isTransitionLocked(),
      [isTransitionLocked, state.status],
    )
    const pointerGesture = usePointerGesture({
      status: state.status,
      canStart: canStartPointerGesture,
      onSwipe: navigate,
    })

  const cardCount = state.status === 'ready' ? state.result.deck.card_order.length : 0
  const currentIndex =
    state.status === 'ready'
      ? state.result.deck.card_order.indexOf(state.currentCard.card_id)
      : -1
  const previousCard =
    state.status === 'ready' && cardCount > 1
      ? getOrderedCard(state.result.deck, (currentIndex - 1 + cardCount) % cardCount)
      : null
  const nextCard =
    state.status === 'ready' && cardCount > 1
      ? getOrderedCard(state.result.deck, (currentIndex + 1) % cardCount)
      : null

  return (
    <main aria-busy={state.status === 'loading'}>
      <h1>Flashcards</h1>
      {state.status === 'loading' && (
        <p className="load-status" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          Loading cards…
        </p>
      )}
      {state.status === 'unavailable' && (
        <section className="load-error" role="alert">
          <span className="unavailable-icon" aria-hidden="true">!</span>
          <p>Content is unavailable for this launch.</p>
          <button type="button" onClick={retry}>Retry</button>
        </section>
      )}
      {state.status === 'ready' && (
        <>
          <div
            className={cardCount > 1
              ? 'card-stage card-stage-navigable'
              : 'card-stage'}
            role="group"
            aria-label="Flashcard carousel"
            onPointerDown={pointerGesture.onPointerDown}
            onPointerMove={pointerGesture.onPointerMove}
            onPointerUp={pointerGesture.onPointerUp}
            onPointerCancel={pointerGesture.onPointerCancel}
            onClickCapture={pointerGesture.onClickCapture}
          >
            {previousCard && (
              <button
                type="button"
                className="card-preview"
                aria-label="Previous card"
                onClick={() => navigate(-1)}
              >
                {unavailablePreviewIds.has(previousCard.card_id) ? (
                  <span className="card-preview-placeholder" aria-hidden="true">!</span>
                ) : (
                  <img
                    className="card-preview-image"
                    src={new URL(previousCard.image, document.baseURI).href}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    onError={() => {
                      setUnavailablePreviewIds((current) =>
                        new Set(current).add(previousCard.card_id),
                      )
                    }}
                  />
                )}
              </button>
            )}
            <button
              ref={attachCardBox}
              type="button"
              className="card-box"
              aria-label={state.face === 'image' ? 'Show word' : 'Show picture'}
              aria-pressed={state.face === 'word'}
              data-transition={transition ?? undefined}
              onClick={toggleFace}
            >
              <div
                ref={cardFlipperRef}
                className="card-flipper"
                data-face={state.face}
                data-transition={transition ?? undefined}
              >
                <div
                  className="card-face card-image-face"
                  aria-hidden={state.face !== 'image'}
                >
                  {state.imageAvailable ? (
                    <img
                      key={state.currentCard.card_id}
                      className="card-image"
                      src={new URL(state.currentCard.image, document.baseURI).href}
                      alt="Picture card"
                      draggable={false}
                      onError={() => {
                        reportImageFailure(state.currentCard)
                        updateReadyState((current) =>
                          current.currentCard.card_id === state.currentCard.card_id
                            ? { ...current, imageAvailable: false }
                            : current,
                        )
                      }}
                    />
                  ) : (
                    <div className="image-unavailable" role="status">
                      <span className="unavailable-icon" aria-hidden="true">!</span>
                      <span>Image unavailable</span>
                    </div>
                  )}
                </div>
                <div
                  className="card-face card-word"
                  aria-hidden={state.face !== 'word'}
                >
                  {state.currentCard.target_word}
                </div>
              </div>
            </button>
            {nextCard && (
              <button
                type="button"
                className="card-preview"
                aria-label="Next card"
                onClick={() => navigate(1)}
              >
                {unavailablePreviewIds.has(nextCard.card_id) ? (
                  <span className="card-preview-placeholder" aria-hidden="true">!</span>
                ) : (
                  <img
                    className="card-preview-image"
                    src={new URL(nextCard.image, document.baseURI).href}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    onError={() => {
                      setUnavailablePreviewIds((current) =>
                        new Set(current).add(nextCard.card_id),
                      )
                    }}
                  />
                )}
              </button>
            )}
            <div className="audio-controls">
              {state.face === 'word' && (
                <>
                  <button
                    type="button"
                    className="audio-replay"
                    data-playback-state={audioStatus}
                    aria-label={audioStatus === 'unavailable' ? 'Retry word audio' : 'Play word again'}
                    onClick={(event) => {
                      event.stopPropagation()
                      playPronunciation(state.currentCard)
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
          <p className="load-status" role="status">
            {state.result.deck.cards.length} cards ready.
            <span className="visually-hidden">
              Card {currentIndex + 1} of {cardCount}, {state.face} side.
            </span>
          </p>
        </>
      )}
    </main>
  )
}

export default App
