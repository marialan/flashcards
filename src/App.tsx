import './App.css'
import {
  useCallback,
  useState,
} from 'react'
import type { Flashcard } from './data/deck'
import type { LoadedDeck } from './data/loadDeck'
import CardStage from './components/CardStage'
import LoadingState from './components/LoadingState'
import UnavailableState from './components/UnavailableState'
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
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'unavailable' && <UnavailableState onRetry={retry} />}
      {state.status === 'ready' && (
        <>
          <CardStage
            card={state.currentCard}
            face={state.face}
            imageAvailable={state.imageAvailable}
            transition={transition}
            audioStatus={audioStatus}
            cardCount={cardCount}
            previousCard={previousCard}
            nextCard={nextCard}
            unavailablePreviewIds={unavailablePreviewIds}
            buttonRef={attachCardBox}
            flipperRef={cardFlipperRef}
            pointerGesture={pointerGesture}
            onSelectCard={navigate}
            onFlip={toggleFace}
            onImageFailure={(card) => {
              reportImageFailure(card)
              updateReadyState((current) =>
                current.currentCard.card_id === card.card_id
                  ? { ...current, imageAvailable: false }
                  : current,
              )
            }}
            onPreviewImageFailure={(cardId) => {
              setUnavailablePreviewIds((current) => new Set(current).add(cardId))
            }}
            onReplay={() => playPronunciation(state.currentCard)}
          />
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
