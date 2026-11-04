import './App.css'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  AudioPlaybackError,
  createAudioController,
  type AudioController,
} from './audio/audioController'
import type { Flashcard } from './data/deck'
import { DeckLoadError, loadDeck, type LoadedDeck } from './data/loadDeck'
import {
  createProgressStorageKey,
  discardSavedProgress,
  readSavedProgress,
  saveProgress,
} from './progress/progress'

interface AppProps {
  deckUrl?: string
  language?: string
}

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ready'
      result: LoadedDeck
      currentCard: Flashcard
      imageAvailable: boolean
      face: 'image' | 'word'
      audioStatus: 'idle' | 'playing' | 'unavailable'
      progressKey: string | null
      transition: VisualTransition | null
    }
  | { status: 'unavailable' }

type VisualTransition = 'flip' | 'next' | 'previous'

interface PointerGesture {
  pointerId: number
  startX: number
  startY: number
  maxTravel: number
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
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const audioControllerRef = useRef<AudioController | null>(null)
  const audioRequestIdRef = useRef(0)
  const audioCardIdRef = useRef<string | null>(null)
  const pointerGestureRef = useRef<PointerGesture | null>(null)
  const suppressPointerClickRef = useRef(false)
  const transitionLockedRef = useRef(false)
  const visualTransitionRef = useRef<VisualTransition | null>(null)
  const transitionTimeoutRef = useRef<number | null>(null)
  const cardBoxRef = useRef<HTMLButtonElement | null>(null)
  const cardFlipperRef = useRef<HTMLDivElement | null>(null)
  const [unavailablePreviewIds, setUnavailablePreviewIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    audioRequestIdRef.current += 1
    audioControllerRef.current?.stop()
    pointerGestureRef.current = null
    suppressPointerClickRef.current = false
    transitionLockedRef.current = false
    visualTransitionRef.current = null
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current)
      transitionTimeoutRef.current = null
    }
    setUnavailablePreviewIds(new Set())
    setState({ status: 'loading' })

    if (!deckUrl || !language) {
      setState({ status: 'unavailable' })
      return () => {
        active = false
        controller.abort()
      }
    }

    const progressKey = createProgressStorageKey(window.location.search, language)
    const savedProgress = progressKey ? readSavedProgress(progressKey) : null

    void loadDeck(deckUrl, language, {
      signal: controller.signal,
      initialCardId: savedProgress?.card_id,
    })
      .then((result) => {
        if (!active) return

        const validSavedProgress =
          savedProgress && result.deck.card_order.includes(savedProgress.card_id)
            ? savedProgress
            : null
        if (savedProgress && !validSavedProgress && progressKey) {
          discardSavedProgress(progressKey)
        }

        if (!result.initialImageAvailable) reportImageFailure(result.initialCard)
        setState({
          status: 'ready',
          result,
          currentCard: result.initialCard,
          imageAvailable: result.initialImageAvailable,
          face: validSavedProgress?.face ?? 'image',
          audioStatus: 'idle',
          progressKey,
          transition: null,
        })
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return

        const category = error instanceof DeckLoadError ? error.category : 'request'
        console.error('Flashcard content load failed.', { category })
        setState({ status: 'unavailable' })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [attempt, deckUrl, language])

  useEffect(
    () => () => {
      audioRequestIdRef.current += 1
      audioControllerRef.current?.dispose()
      transitionLockedRef.current = false
      visualTransitionRef.current = null
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current)
      }
    },
    [],
  )

  function retry() {
    setAttempt((current) => current + 1)
  }

  function reportAudioFailure(error: AudioPlaybackError) {
    console.error('Pronunciation audio unavailable.', {
      category: error.category,
      cardId: audioCardIdRef.current,
      asset: error.asset,
    })
    setState((current) =>
      current.status === 'ready'
        ? { ...current, audioStatus: 'unavailable' }
        : current,
    )
  }

  function setAudioPlaybackStatus(status: 'idle' | 'playing') {
    setState((current) => {
      if (current.status !== 'ready') return current
      if (status === 'idle' && current.audioStatus !== 'playing') return current
      return { ...current, audioStatus: status }
    })
  }

  function playPronunciation(card: LoadedDeck['initialCard']) {
    const requestId = ++audioRequestIdRef.current
    audioCardIdRef.current = card.card_id
    audioControllerRef.current ??= createAudioController(
      reportAudioFailure,
      setAudioPlaybackStatus,
    )
    setState((current) =>
      current.status === 'ready' && current.audioStatus === 'playing'
        ? { ...current, audioStatus: 'idle' }
        : current,
    )

    const asset = new URL(card.audio, document.baseURI).href
    void audioControllerRef.current.play(asset).then(
      () => {
        if (requestId !== audioRequestIdRef.current) return
        setState((current) =>
          current.status === 'ready' && current.face === 'word'
            ? { ...current, audioStatus: 'playing' }
            : current,
        )
      },
      (error: unknown) => {
        if (error instanceof AudioPlaybackError) return

        console.error('Pronunciation playback failed unexpectedly.', {
          category: 'audio',
          cardId: card.card_id,
          asset,
          error,
        })
        setState((current) =>
          current.status === 'ready'
            ? { ...current, audioStatus: 'unavailable' }
            : current,
        )
      },
    )
  }

  const finishVisualTransition = useCallback(() => {
    transitionLockedRef.current = false
    visualTransitionRef.current = null
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current)
      transitionTimeoutRef.current = null
    }
    setState((current) =>
      current.status === 'ready' && current.transition !== null
        ? { ...current, transition: null }
        : current,
    )
  }, [])

  const handleCardTransitionEnd = useCallback((event: Event) => {
    if (
      event.target === cardFlipperRef.current &&
      visualTransitionRef.current === 'flip' &&
      (event as TransitionEvent).propertyName === 'transform'
    ) {
      finishVisualTransition()
    }
  }, [finishVisualTransition])

  const handleCardTransitionCancel = useCallback((event: Event) => {
    if (
      event.target === cardFlipperRef.current &&
      visualTransitionRef.current === 'flip'
    ) {
      finishVisualTransition()
    }
  }, [finishVisualTransition])

  const handleCardAnimationEnd = useCallback((event: Event) => {
    if (
      event.target === cardBoxRef.current &&
      visualTransitionRef.current !== null &&
      visualTransitionRef.current !== 'flip'
    ) {
      finishVisualTransition()
    }
  }, [finishVisualTransition])

  const handleCardAnimationCancel = useCallback((event: Event) => {
    if (
      event.target === cardBoxRef.current &&
      visualTransitionRef.current !== null &&
      visualTransitionRef.current !== 'flip'
    ) {
      finishVisualTransition()
    }
  }, [finishVisualTransition])

  const attachCardBox = useCallback((element: HTMLButtonElement | null) => {
    const previous = cardBoxRef.current
    if (previous) {
      previous.removeEventListener('transitionend', handleCardTransitionEnd)
      previous.removeEventListener('transitioncancel', handleCardTransitionCancel)
      previous.removeEventListener('animationend', handleCardAnimationEnd)
      previous.removeEventListener('animationcancel', handleCardAnimationCancel)
    }
    cardBoxRef.current = element
    if (element) {
      element.addEventListener('transitionend', handleCardTransitionEnd)
      element.addEventListener('transitioncancel', handleCardTransitionCancel)
      element.addEventListener('animationend', handleCardAnimationEnd)
      element.addEventListener('animationcancel', handleCardAnimationCancel)
    }
  }, [
    handleCardAnimationCancel,
    handleCardAnimationEnd,
    handleCardTransitionCancel,
    handleCardTransitionEnd,
  ])

  function beginVisualTransition(transition: VisualTransition): VisualTransition | null {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null

    transitionLockedRef.current = true
    visualTransitionRef.current = transition
    transitionTimeoutRef.current = window.setTimeout(finishVisualTransition, 300)
    return transition
  }

  function toggleFace() {
    if (state.status !== 'ready' || transitionLockedRef.current) return
    const card = state.currentCard
    const transition = beginVisualTransition('flip')

    if (state.face === 'word') {
      saveProgress(state.progressKey, card.card_id, 'image')
      audioRequestIdRef.current += 1
      audioControllerRef.current?.stop()
      setState((current) =>
        current.status === 'ready'
          ? {
              ...current,
              face: 'image',
              audioStatus: current.audioStatus === 'playing' ? 'idle' : current.audioStatus,
              transition,
            }
          : current,
      )
      return
    }

    saveProgress(state.progressKey, card.card_id, 'word')
    setState({
      ...state,
      face: 'word',
      audioStatus: state.audioStatus === 'playing' ? 'idle' : state.audioStatus,
      transition,
    })
    playPronunciation(card)
  }

  function navigate(direction: -1 | 1) {
    if (state.status !== 'ready' || transitionLockedRef.current) return

    const cardCount = state.result.deck.card_order.length
    if (cardCount < 2) return

    const currentIndex = state.result.deck.card_order.indexOf(state.currentCard.card_id)
    const nextIndex = (currentIndex + direction + cardCount) % cardCount
    const nextCard = getOrderedCard(state.result.deck, nextIndex)
    const transition = beginVisualTransition(direction > 0 ? 'next' : 'previous')
    audioRequestIdRef.current += 1
    audioControllerRef.current?.stop()
    saveProgress(state.progressKey, nextCard.card_id, 'image')
    setState((current) =>
      current.status === 'ready'
        ? {
            ...current,
            currentCard: nextCard,
            imageAvailable: true,
            face: 'image',
            audioStatus: 'idle',
            transition,
          }
        : current,
    )
  }

  function startPointerGesture(event: ReactPointerEvent<HTMLDivElement>) {
    if (state.status !== 'ready' || transitionLockedRef.current) return
    if (pointerGestureRef.current) {
      pointerGestureRef.current = null
      suppressPointerClickRef.current = true
      return
    }
    if (!event.isPrimary || event.button !== 0) return

    suppressPointerClickRef.current = false
    pointerGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      maxTravel: 0,
    }

    const captureTarget =
      event.target instanceof Element
        ? event.target.closest('button') ?? event.currentTarget
        : event.currentTarget
    captureTarget.setPointerCapture?.(event.pointerId)
  }

  function updatePointerGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = pointerGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    gesture.maxTravel = Math.max(
      gesture.maxTravel,
      Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY),
    )
  }

  function finishPointerGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = pointerGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    updatePointerGesture(event)
    pointerGestureRef.current = null
    if (gesture.maxTravel <= 10) return

    suppressPointerClickRef.current = true
    const horizontalTravel = event.clientX - gesture.startX
    const verticalTravel = event.clientY - gesture.startY
    if (Math.abs(horizontalTravel) >= 40 && Math.abs(horizontalTravel) > Math.abs(verticalTravel)) {
      navigate(horizontalTravel < 0 ? 1 : -1)
    }
  }

  function cancelPointerGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = pointerGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    pointerGestureRef.current = null
    suppressPointerClickRef.current = true
  }

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
            onPointerDown={startPointerGesture}
            onPointerMove={updatePointerGesture}
            onPointerUp={finishPointerGesture}
            onPointerCancel={cancelPointerGesture}
            onClickCapture={(event) => {
              if (!suppressPointerClickRef.current || event.detail === 0) return
              suppressPointerClickRef.current = false
              event.preventDefault()
              event.stopPropagation()
            }}
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
              data-transition={state.transition ?? undefined}
              onClick={toggleFace}
            >
              <div
                ref={cardFlipperRef}
                className="card-flipper"
                data-face={state.face}
                data-transition={state.transition ?? undefined}
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
                        setState((current) =>
                          current.status === 'ready' &&
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
                    data-playback-state={state.audioStatus}
                    aria-label={state.audioStatus === 'unavailable' ? 'Retry word audio' : 'Play word again'}
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
                      {state.audioStatus === 'unavailable' && (
                        <span className="audio-warning">!</span>
                      )}
                    </span>
                    <span>
                      {state.audioStatus === 'playing'
                        ? 'Playing'
                        : state.audioStatus === 'unavailable'
                          ? 'Retry audio'
                          : 'Replay'}
                    </span>
                  </button>
                  {state.audioStatus !== 'idle' && (
                    <p className="audio-status" role="status">
                      {state.audioStatus === 'unavailable'
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
