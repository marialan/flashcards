import './App.css'
import { useEffect, useRef, useState } from 'react'
import {
  AudioPlaybackError,
  createAudioController,
  type AudioController,
} from './audio/audioController'
import { DeckLoadError, loadDeck, type LoadedDeck } from './data/loadDeck'

interface AppProps {
  deckUrl?: string
  language?: string
}

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ready'
      result: LoadedDeck
      imageAvailable: boolean
      face: 'image' | 'word'
      audioStatus: 'idle' | 'playing' | 'unavailable'
    }
  | { status: 'unavailable' }

function reportImageFailure(result: LoadedDeck) {
  console.error('Flashcard image unavailable.', {
    category: 'image',
    cardId: result.initialCard.card_id,
    asset: result.initialCard.image,
  })
}

function App({ deckUrl, language }: AppProps = {}) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const audioControllerRef = useRef<AudioController | null>(null)
  const audioRequestIdRef = useRef(0)
  const audioCardIdRef = useRef<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    audioRequestIdRef.current += 1
    audioControllerRef.current?.stop()
    setState({ status: 'loading' })

    if (!deckUrl || !language) {
      setState({ status: 'unavailable' })
      return () => {
        active = false
        controller.abort()
      }
    }

    void loadDeck(deckUrl, language, { signal: controller.signal })
      .then((result) => {
        if (!active) return

        if (!result.initialImageAvailable) reportImageFailure(result)
        setState({
          status: 'ready',
          result,
          imageAvailable: result.initialImageAvailable,
          face: 'image',
          audioStatus: 'idle',
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

  function toggleFace() {
    if (state.status !== 'ready') return

    if (state.face === 'word') {
      audioRequestIdRef.current += 1
      audioControllerRef.current?.stop()
      setState((current) =>
        current.status === 'ready'
          ? {
              ...current,
              face: 'image',
              audioStatus: current.audioStatus === 'playing' ? 'idle' : current.audioStatus,
            }
          : current,
      )
      return
    }

    const card = state.result.initialCard
    setState({
      ...state,
      face: 'word',
      audioStatus: state.audioStatus === 'playing' ? 'idle' : state.audioStatus,
    })
    playPronunciation(card)
  }

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
          <div className="card-stage">
            <button
              type="button"
              className="card-box"
              aria-label={state.face === 'image' ? 'Show word' : 'Show picture'}
              aria-pressed={state.face === 'word'}
              onClick={toggleFace}
            >
              {state.imageAvailable ? (
                <img
                  className="card-image"
                  src={new URL(state.result.initialCard.image, document.baseURI).href}
                  alt="Picture card"
                  hidden={state.face !== 'image'}
                  onError={() => {
                    reportImageFailure(state.result)
                    setState((current) =>
                      current.status === 'ready'
                        ? { ...current, imageAvailable: false }
                        : current,
                    )
                  }}
                />
              ) : (
                <div className="image-unavailable" role="status" hidden={state.face !== 'image'}>
                  <span className="unavailable-icon" aria-hidden="true">!</span>
                  <span>Image unavailable</span>
                </div>
              )}
              <div className="card-word" hidden={state.face !== 'word'}>
                {state.result.initialCard.target_word}
              </div>
            </button>
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
                      playPronunciation(state.result.initialCard)
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
          </p>
        </>
      )}
    </main>
  )
}

export default App
