import './App.css'
import { useEffect, useState } from 'react'
import { DeckLoadError, loadDeck, type LoadedDeck } from './data/loadDeck'

interface AppProps {
  deckUrl?: string
  language?: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; result: LoadedDeck; imageAvailable: boolean }
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

  useEffect(() => {
    const controller = new AbortController()
    let active = true

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

  function retry() {
    setAttempt((current) => current + 1)
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
          <div className="card-box">
            {state.imageAvailable ? (
              <img
                className="card-image"
                src={new URL(state.result.initialCard.image, document.baseURI).href}
                alt="Picture card"
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
              <div className="image-unavailable" role="status">
                <span className="unavailable-icon" aria-hidden="true">!</span>
                <span>Image unavailable</span>
              </div>
            )}
            <div className="card-word" hidden>
              {state.result.initialCard.target_word}
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
