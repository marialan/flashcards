import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows retryable unavailability while launch lookup is unresolved', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Flashcards', level: 1 })).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Content is unavailable for this launch.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByRole('alert')).toBeVisible()
  })

  it('retries a failed load using the same launch context', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            schema_version: 1,
            language: 'english',
            cards: [{
              card_id: 'sat',
              target_word: 'sat',
              image: 'lang/english/images/sat.png',
              audio: 'lang/english/audios/sat.mp3',
            }],
            card_order: ['sat'],
          }),
      })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(value: string) {
        if (value) queueMicrotask(() => this.onload?.())
      }
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<App deckUrl="/lang/english/deck.json" language="english" />)
    expect(await screen.findByRole('alert')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('1 cards ready.')
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows loading feedback and aborts an obsolete request on unmount', async () => {
    let requestSignal: AbortSignal | undefined
    vi.stubGlobal('fetch', vi.fn((_url: string, options: { signal: AbortSignal }) => {
      requestSignal = options.signal
      return new Promise(() => undefined)
    }))

    const { unmount } = render(<App deckUrl="/deck.json" language="english" />)

    expect(await screen.findByRole('status')).toHaveTextContent('Loading cards…')
    expect(document.querySelector('.card-box')).not.toBeInTheDocument()
    unmount()

    expect(requestSignal?.aborted).toBe(true)
  })

  it('shows the card box only after a deck is ready', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          schema_version: 1,
          language: 'english',
          cards: [
            {
              card_id: 'mat',
              target_word: 'mat',
              image: 'lang/english/images/mat.png',
              audio: 'lang/english/audios/mat.mp3',
            },
            {
              card_id: 'sat',
              target_word: 'sat',
              image: 'lang/english/images/sat.png',
              audio: 'lang/english/audios/sat.mp3',
            },
          ],
          card_order: ['sat', 'mat'],
        }),
    }))
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(value: string) {
        if (value) queueMicrotask(() => this.onload?.())
      }
    })

    render(<App deckUrl="/lang/english/deck.json" language="english" />)

    expect(await screen.findByText('2 cards ready.')).toBeVisible()
    expect(document.querySelector('.card-box')).toBeInTheDocument()
    const image = screen.getByRole('img', { name: 'Picture card' })
    expect(image).toHaveAttribute(
      'src',
      new URL('lang/english/images/sat.png', document.baseURI).href,
    )
    expect(image).toHaveClass('card-image')
    expect(screen.getByRole('heading', { name: 'Flashcards', level: 1 })).toBeVisible()
  })

  it('shows an explicit image-failure state without making the deck unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          schema_version: 1,
          language: 'english',
          cards: [{
            card_id: 'sat',
            target_word: 'sat',
            image: 'lang/english/images/sat.png',
            audio: 'lang/english/audios/sat.mp3',
          }],
          card_order: ['sat'],
        }),
    }))
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(value: string) {
        if (value) queueMicrotask(() => this.onerror?.())
      }
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<App deckUrl="/lang/english/deck.json" language="english" />)

    expect(await screen.findByText('Image unavailable')).toBeVisible()
    expect(screen.getByText('1 cards ready.')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(document.querySelector('.card-box')).toBeInTheDocument()
    expect(errorSpy).toHaveBeenCalledWith('Flashcard image unavailable.', {
      category: 'image',
      cardId: 'sat',
      asset: 'lang/english/images/sat.png',
    })
  })

  it('replaces an image that fails after preload with the unavailable state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          schema_version: 1,
          language: 'english',
          cards: [{
            card_id: 'sat',
            target_word: 'sat',
            image: 'lang/english/images/sat.png',
            audio: 'lang/english/audios/sat.mp3',
          }],
          card_order: ['sat'],
        }),
    }))
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(value: string) {
        if (value) queueMicrotask(() => this.onload?.())
      }
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<App deckUrl="/lang/english/deck.json" language="english" />)
    const image = await screen.findByRole('img', { name: 'Picture card' })

    fireEvent.error(image)

    expect(await screen.findByText('Image unavailable')).toBeVisible()
    expect(screen.getByText('1 cards ready.')).toBeVisible()
  })
})
