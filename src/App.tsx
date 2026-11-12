import './App.css'
import { useCallback, useEffect, useState } from 'react'
import type { Flashcard } from './data/deck'
import type { LoadedDeck } from './data/loadDeck'
import type { Sticker } from './data/stickers'
import type { StickerPosition } from './utils/stickerPlacement'
import CardStage from './components/CardStage'
import CardProgress from './components/CardProgress'
import LoadingState from './components/LoadingState'
import UnavailableState from './components/UnavailableState'
import StickerBookIndicator from './components/StickerBookIndicator'
import { useAudioController } from './hooks/useAudioController'
import { useCardTransition } from './hooks/useCardTransition'
import { useDeckLoading } from './hooks/useDeckLoading'
import { usePointerGesture } from './hooks/usePointerGesture'
import { useStickerCollection } from './hooks/useStickerCollection'
import { saveProgress, createStickerStorageKey } from './progress/progress'
import { loadStickerPool, selectRandomSticker } from './data/stickers'
import { calculateStickerPosition } from './utils/stickerPlacement'

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
  const [activeSticker, setActiveSticker] = useState<Sticker | null>(null)
  const [stickerPosition, setStickerPosition] = useState<StickerPosition | null>(null)
  const [stickerPool, setStickerPool] = useState<Sticker[]>([])

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

  // Initialize sticker collection state
  const stickerStorageKey = state.status === 'ready' && language
    ? createStickerStorageKey(window.location.search, language)
    : null
  
  const {
    collectedIds,
    flipsSinceLastSticker,
    markStickerCollected,
    resetFlipsCounter,
    incrementFlipsCounter,
    hasAllStickersCollected,
  } = useStickerCollection(stickerStorageKey)

  // Load sticker pool on app init
  useEffect(() => {
    loadStickerPool().then(setStickerPool)
  }, [])

  const toggleFace = useCallback(() => {
    if (state.status !== 'ready' || isTransitionLocked()) return

    const card = state.currentCard
    beginTransition('flip')

    if (state.face === 'word') {
      saveProgress(state.progressKey, card.card_id, 'image')
      stopAudio()
      setActiveSticker(null)
      setStickerPosition(null)
      updateReadyState((current) => ({ ...current, face: 'image' }))
      return
    }

    saveProgress(state.progressKey, card.card_id, 'word')
    updateReadyState((current) => ({ ...current, face: 'word' }))
    playPronunciation(card)

    // Check if we should spawn a sticker (only on word reveal)
    if (stickerPool.length > 0 && !hasAllStickersCollected(stickerPool.length)) {
      const allCollected = collectedIds.size >= stickerPool.length
      if (!allCollected) {
        const shouldSpawn =
          flipsSinceLastSticker >= 10 || Math.random() < 0.05
        
        if (shouldSpawn) {
          const selectedSticker = selectRandomSticker(stickerPool, collectedIds)
          if (selectedSticker) {
            setActiveSticker(selectedSticker)
            resetFlipsCounter()
            
            // Calculate position after a small delay to ensure DOM is updated
            setTimeout(() => {
              const cardElement = document.querySelector('.card-main')
              const wordElement = document.querySelector('.card-word')
              const controls = document.querySelectorAll('.audio-replay')
              
              if (cardElement instanceof HTMLElement && wordElement instanceof HTMLElement) {
                const position = calculateStickerPosition(
                  cardElement,
                  wordElement,
                  Array.from(controls).filter((el): el is HTMLElement => el instanceof HTMLElement),
                )
                setStickerPosition(position)
              }
            }, 50)
          }
        } else {
          incrementFlipsCounter()
        }
      }
    }
  }, [
    beginTransition,
    isTransitionLocked,
    playPronunciation,
    saveProgress,
    state,
    stopAudio,
    updateReadyState,
    stickerPool,
    collectedIds,
    flipsSinceLastSticker,
    hasAllStickersCollected,
    resetFlipsCounter,
    incrementFlipsCounter,
  ])

  const navigate = useCallback((direction: -1 | 1) => {
    if (state.status !== 'ready' || isTransitionLocked()) return

    const cardCount = state.result.deck.card_order.length
    if (cardCount < 2) return

    const currentIndex = state.result.deck.card_order.indexOf(state.currentCard.card_id)
    const nextIndex = (currentIndex + direction + cardCount) % cardCount
    const nextCard = getOrderedCard(state.result.deck, nextIndex)
    beginTransition(direction > 0 ? 'next' : 'previous')
    resetAudio()
    saveProgress(state.progressKey, nextCard.card_id, 'image')
    setActiveSticker(null)
    setStickerPosition(null)
    updateReadyState((current) => ({
      ...current,
      currentCard: nextCard,
      imageAvailable: true,
      face: 'image',
    }))
  }, [
    beginTransition,
    isTransitionLocked,
    resetAudio,
    saveProgress,
    state,
    updateReadyState,
  ])

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
  const handleImageFailure = useCallback((card: Flashcard) => {
    reportImageFailure(card)
    updateReadyState((current) =>
      current.currentCard.card_id === card.card_id
        ? { ...current, imageAvailable: false }
        : current,
    )
  }, [updateReadyState])
  const handlePreviewImageFailure = useCallback((cardId: string) => {
    setUnavailablePreviewIds((current) => new Set(current).add(cardId))
  }, [])
  const replayPronunciation = useCallback(() => {
    if (state.status === 'ready') playPronunciation(state.currentCard)
  }, [playPronunciation, state])

  const handleStickerCollected = useCallback(
    (stickerId: string) => {
      markStickerCollected(stickerId)
      setActiveSticker(null)
      setStickerPosition(null)
    },
    [markStickerCollected],
  )

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
            onImageFailure={handleImageFailure}
            onPreviewImageFailure={handlePreviewImageFailure}
            onReplay={replayPronunciation}
            activeSticker={activeSticker}
            stickerPosition={stickerPosition}
            onStickerCollected={handleStickerCollected}
          />
          <CardProgress cardCount={cardCount} currentIndex={currentIndex} />
          <StickerBookIndicator collectedCount={collectedIds.size} />
          <p className="visually-hidden" role="status">
            Card {currentIndex + 1} of {cardCount}, {state.face} side.
          </p>
        </>
      )}
    </main>
  )
}

export default App
