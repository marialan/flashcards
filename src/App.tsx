import './App.css'
import { useEffect, useState } from 'react'
import { DeckLoadError, loadDeck, type LoadedDeck } from './data/loadDeck'

interface AppProps {
  deckUrl?: string
  language?: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; result: LoadedDeck }
  | { status: 'unavailable' }

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
        if (active) setState({ status: 'ready', result })
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
        <p className="load-status" role="status">
          {state.result.initialImageAvailable
            ? `${state.result.deck.cards.length} cards ready.`
            : `${state.result.deck.cards.length} cards ready; the first image is unavailable.`}
        </p>
      )}
    </main>
  )
}

export default App
