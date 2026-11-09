import { useCallback, useEffect, useState } from 'react'
import type { Flashcard } from '../data/deck'
import { DeckLoadError, loadDeck, type LoadedDeck } from '../data/loadDeck'
import {
  createProgressStorageKey,
  discardSavedProgress,
  readSavedProgress,
} from '../progress/progress'

export interface ReadyLoadState {
  status: 'ready'
  result: LoadedDeck
  currentCard: Flashcard
  imageAvailable: boolean
  face: 'image' | 'word'
  progressKey: string | null
}

export type DeckLoadingState =
  | { status: 'loading' }
  | ReadyLoadState
  | { status: 'unavailable' }

interface UseDeckLoadingOptions {
  deckUrl?: string
  language?: string
  resetAudio: () => void
  resetTransition: () => void
  onLoadingStart: () => void
  onInitialImageFailure: (card: Flashcard) => void
}

export function useDeckLoading({
  deckUrl,
  language,
  resetAudio,
  resetTransition,
  onLoadingStart,
  onInitialImageFailure,
}: UseDeckLoadingOptions) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<DeckLoadingState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    resetAudio()
    resetTransition()
    onLoadingStart()
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

        if (!result.initialImageAvailable) onInitialImageFailure(result.initialCard)
        setState({
          status: 'ready',
          result,
          currentCard: result.initialCard,
          imageAvailable: result.initialImageAvailable,
          face: validSavedProgress?.face ?? 'image',
          progressKey,
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
  }, [
    attempt,
    deckUrl,
    language,
    onInitialImageFailure,
    onLoadingStart,
    resetAudio,
    resetTransition,
  ])

  const retry = useCallback(() => {
    setAttempt((current) => current + 1)
  }, [])

  const updateReadyState = useCallback(
    (update: (current: ReadyLoadState) => ReadyLoadState) => {
      setState((current) => current.status === 'ready' ? update(current) : current)
    },
    [],
  )

  return { state, retry, updateReadyState }
}

export default useDeckLoading
