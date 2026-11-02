import { parseDeckJson, type FlashcardDeck } from './deck'

export type DeckLoadFailureCategory =
  | 'request'
  | 'timeout'
  | 'invalid_deck'
  | 'image'
  | 'unavailable'

export class DeckLoadError extends Error {
  readonly category: DeckLoadFailureCategory

  constructor(
    message: string,
    category: DeckLoadFailureCategory,
  ) {
    super(message)
    this.name = 'DeckLoadError'
    this.category = category
  }
}

export interface LoadedDeck {
  deck: FlashcardDeck
  initialCard: FlashcardDeck['cards'][number]
  initialImageAvailable: boolean
}

interface LoadDeckOptions {
  signal: AbortSignal
  timeoutMs?: number
  assetBaseUrl?: string
}

function createAbortError() {
  return new DOMException('The operation was aborted.', 'AbortError')
}

function requestDeckText(url: URL, signal: AbortSignal, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    let settled = false

    const cleanup = () => {
      clearTimeout(timeoutId)
      signal.removeEventListener('abort', abort)
    }

    const succeed = (text: string) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(text)
    }

    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const abort = () => {
      controller.abort()
      fail(signal.reason ?? createAbortError())
    }

    const timeoutId = setTimeout(() => {
      controller.abort()
      fail(new DeckLoadError('Deck loading timed out.', 'timeout'))
    }, timeoutMs)

    if (signal.aborted) {
      abort()
      return
    }

    signal.addEventListener('abort', abort, { once: true })

    try {
      if (url.protocol === 'file:') {
        const request = new XMLHttpRequest()
        request.open('GET', url.href)
        request.timeout = timeoutMs
        controller.signal.addEventListener('abort', () => request.abort(), { once: true })
        request.onload = () => {
          if (request.status === 0 || request.status === 200) {
            succeed(request.responseText)
          } else {
            onFailure(
              new DeckLoadError(`Deck request failed with status ${request.status}.`, 'request'),
            )
          }
        }
        request.onerror = () => onFailure(new DeckLoadError('Deck request failed.', 'request'))
        request.ontimeout = () =>
          onFailure(new DeckLoadError('Deck loading timed out.', 'timeout'))
        request.onabort = () => {
          if (!controller.signal.aborted) onFailure(createAbortError())
        }
        request.send()
        return
      }

      fetch(url.href, { signal: controller.signal, redirect: 'error' })
        .then(async (response) => {
          if (!response.ok) {
            throw new DeckLoadError(
              `Deck request failed with status ${response.status}.`,
              'request',
            )
          }

          return response.text()
        })
        .then(succeed, onFailure)
    } catch (error) {
      onFailure(error)
    }

    function onFailure(error: unknown) {
      if (signal.aborted) {
        fail(signal.reason ?? createAbortError())
      } else {
        fail(
          error instanceof DeckLoadError
            ? error
            : new DeckLoadError('Deck data could not be loaded.', 'request'),
        )
      }
    }
  })
}

function loadImage(url: string, signal: AbortSignal, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? createAbortError())
      return
    }

    const image = new Image()
    let settled = false

    const finish = (available: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      signal.removeEventListener('abort', abort)
      image.onload = null
      image.onerror = null
      if (!available) image.src = ''
      resolve(available)
    }

    const abort = () => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      image.onload = null
      image.onerror = null
      image.src = ''
      reject(signal.reason ?? createAbortError())
    }

    const timeoutId = setTimeout(() => finish(false), timeoutMs)
    signal.addEventListener('abort', abort, { once: true })
    image.onload = () => finish(true)
    image.onerror = () => finish(false)
    image.src = url
  })
}

export async function loadDeck(
  deckUrl: string,
  expectedLanguage: string,
  { signal, timeoutMs = 10_000, assetBaseUrl = document.baseURI }: LoadDeckOptions,
): Promise<LoadedDeck> {
  const startedAt = Date.now()
  let source: string
  let url: URL

  try {
    url = new URL(deckUrl, document.baseURI)
    const appUrl = new URL(document.baseURI)
    const isLocalHttp =
      (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === appUrl.origin
    if (url.protocol !== 'file:' && !isLocalHttp) {
      throw new DeckLoadError('Deck data must be loaded from the installed app.', 'request')
    }

    source = await requestDeckText(url, signal, timeoutMs)
  } catch (error) {
    if (signal.aborted || error instanceof DeckLoadError) throw error
    throw new DeckLoadError('Deck data could not be loaded.', 'request')
  }

  let deck: FlashcardDeck
  try {
    deck = parseDeckJson(source, expectedLanguage)
  } catch (error) {
    throw new DeckLoadError(
      error instanceof Error ? error.message : 'Deck data is invalid.',
      'invalid_deck',
    )
  }

  const firstCardId = deck.card_order[0]
  const firstCard = deck.cards.find(({ card_id }) => card_id === firstCardId)
  if (!firstCard) {
    throw new DeckLoadError('The first ordered card is unavailable.', 'invalid_deck')
  }

  const remainingMs = Math.max(0, timeoutMs - (Date.now() - startedAt))
  let initialImageAvailable = false
  if (remainingMs > 0) {
    try {
      initialImageAvailable = await loadImage(
        new URL(firstCard.image, assetBaseUrl).href,
        signal,
        remainingMs,
      )
    } catch (error) {
      if (signal.aborted) throw error
      throw new DeckLoadError('The first card image could not be checked.', 'image')
    }
  }

  return { deck, initialCard: firstCard, initialImageAvailable }
}
