import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Flashcard } from './data/deck'

function stubDeck(cards: Flashcard[], cardOrder = cards.map(({ card_id }) => card_id)) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      schema_version: 1,
      language: 'english',
      cards,
      card_order: cardOrder,
    }),
  }))
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(value: string) {
      if (value) queueMicrotask(() => this.onload?.())
    }
  })
}

function createCards(...cardIds: string[]): Flashcard[] {
  return cardIds.map((cardId) => ({
    card_id: cardId,
    target_word: cardId,
    image: `assets/images/${cardId}.png`,
    audio: `lang/english/audios/${cardId}.mp3`,
  }))
}

function dispatchPointer(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  details: {
    pointerId: number
    clientX: number
    clientY: number
    button?: number
    isPrimary?: boolean
  },
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  for (const [key, value] of Object.entries({
    button: 0,
    isPrimary: true,
    ...details,
  })) {
    Object.defineProperty(event, key, { value })
  }
  act(() => target.dispatchEvent(event))
}

function completeVisualTransition() {
  const card = screen.getByRole('button', { name: /Show (word|picture)/ })
  if (
    card.getAttribute('data-transition') === 'next' ||
    card.getAttribute('data-transition') === 'previous'
  ) {
    act(() => card.dispatchEvent(new Event('animationend', { bubbles: true })))
    return
  }

  const flipper = card.querySelector('.card-flipper')
  if (!flipper) throw new Error('The card flipper is unavailable.')
  const event = new Event('transitionend', { bubbles: true })
  Object.defineProperty(event, 'propertyName', { value: 'transform' })
  act(() => flipper.dispatchEvent(event))
}

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
    window.history.replaceState(null, '', '/')
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
              image: 'assets/images/sat.png',
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
              image: 'assets/images/mat.png',
              audio: 'lang/english/audios/mat.mp3',
            },
            {
              card_id: 'sat',
              target_word: 'Café extraordinarilylongword',
              image: 'assets/images/sat.png',
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
      new URL('assets/images/sat.png', document.baseURI).href,
    )
    expect(image).toHaveClass('card-image')
    const wordFace = screen.getByText('Café extraordinarilylongword')
    expect(wordFace).toHaveClass('card-word')
    expect(wordFace).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('heading', { name: 'Flashcards', level: 1 })).toBeVisible()
  })

  it('navigates in deck order, wraps, resets the face, and stops audio', async () => {
    class MockAudio {
      src = ''
      currentTime = 0
      error: MediaError | null = null
      onerror: (() => void) | null = null
      onplaying: (() => void) | null = null
      onended: (() => void) | null = null
      readonly play = vi.fn(async () => {
        this.onplaying?.()
      })
      readonly pause = vi.fn()
      readonly load = vi.fn()
      readonly removeAttribute = vi.fn((name: string) => {
        if (name === 'src') this.src = ''
      })
    }

    let audio: MockAudio | undefined
    vi.stubGlobal('Audio', class extends MockAudio {
      constructor() {
        super()
        audio = this
      }
    })
    stubDeck([
      {
        card_id: 'mat',
        target_word: 'mat',
        image: 'assets/images/mat.png',
        audio: 'lang/english/audios/mat.mp3',
      },
      {
        card_id: 'sat',
        target_word: 'sat',
        image: 'assets/images/sat.png',
        audio: 'lang/english/audios/sat.mp3',
      },
      {
        card_id: 'cat',
        target_word: 'cat',
        image: 'assets/images/cat.png',
        audio: 'lang/english/audios/cat.mp3',
      },
    ], ['sat', 'cat', 'mat'])
    window.history.replaceState(
      null,
      '',
      '/?cr_lang=english&cr_user_id=user-one',
    )

    render(<App deckUrl="/lang/english/deck.json" language="english" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Show word' }))
    completeVisualTransition()
    expect(await screen.findByRole('button', { name: 'Play word again' })).toBeVisible()
    expect(audio?.play).toHaveBeenCalledTimes(1)
    const nextButton = screen.getByRole('button', { name: 'Next card' })
    nextButton.focus()
    fireEvent.click(nextButton)
    completeVisualTransition()

    expect(nextButton).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Show word' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('img', { name: 'Picture card' })).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/cat.png'),
    )
    expect(audio?.src).toBe('')
    expect(audio?.currentTime).toBe(0)
    expect(audio?.play).toHaveBeenCalledTimes(1)
    expect(
      JSON.parse(localStorage.getItem('flashcards:progress:v1:english:user-one') ?? 'null'),
    ).toEqual({ schema_version: 1, card_id: 'cat', face: 'image' })

    fireEvent.click(nextButton)
    completeVisualTransition()
    expect(screen.getByRole('img', { name: 'Picture card' })).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/mat.png'),
    )
    fireEvent.click(nextButton)
    completeVisualTransition()
    expect(screen.getByRole('img', { name: 'Picture card' })).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/sat.png'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Previous card' }))
    completeVisualTransition()
    expect(screen.getByRole('img', { name: 'Picture card' })).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/mat.png'),
    )
  })

  it('uses distinct previous and next actions for a two-card deck', async () => {
    stubDeck([
      {
        card_id: 'sat',
        target_word: 'sat',
        image: 'assets/images/sat.png',
        audio: 'lang/english/audios/sat.mp3',
      },
      {
        card_id: 'mat',
        target_word: 'mat',
        image: 'assets/images/mat.png',
        audio: 'lang/english/audios/mat.mp3',
      },
    ])

    render(<App deckUrl="/lang/english/deck.json" language="english" />)

    const nextButton = await screen.findByRole('button', { name: 'Next card' })
    const previousButton = screen.getByRole('button', { name: 'Previous card' })
    fireEvent.click(nextButton)
    completeVisualTransition()
    expect(screen.getByRole('img', { name: 'Picture card' })).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/mat.png'),
    )
    fireEvent.click(previousButton)
    completeVisualTransition()
    expect(screen.getByRole('img', { name: 'Picture card' })).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/sat.png'),
    )
  })

  it('shows image peeks with distinct names and keeps focus on navigation', async () => {
    stubDeck(createCards('sat', 'mat', 'cat'))

    render(<App deckUrl="/lang/english/deck.json" language="english" />)

    const previousButton = await screen.findByRole('button', { name: 'Previous card' })
    const nextButton = screen.getByRole('button', { name: 'Next card' })
    expect(previousButton.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/cat.png'),
    )
    expect(nextButton.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/mat.png'),
    )
    expect(previousButton.querySelector('img')).toHaveAttribute('aria-hidden', 'true')
    expect(nextButton.querySelector('img')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getAllByRole('img', { name: 'Picture card' })).toHaveLength(1)

    nextButton.focus()
    fireEvent.click(nextButton)
    completeVisualTransition()

    expect(nextButton).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Card 2 of 3, image side.')
    expect(screen.getByRole('img', { name: 'Picture card' })).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/mat.png'),
    )
  })

  it.each([
    { displacement: 39, shouldNavigate: false },
    { displacement: 40, shouldNavigate: true },
    { displacement: 41, shouldNavigate: true },
  ])('recognizes $displacement px horizontal swipes at the threshold', async ({
    displacement,
    shouldNavigate,
  }) => {
    stubDeck(createCards('sat', 'mat', 'cat'))

    render(<App deckUrl="/lang/english/deck.json" language="english" />)

    const card = await screen.findByRole('button', { name: 'Show word' })
    const carousel = screen.getByRole('group', { name: 'Flashcard carousel' })
    dispatchPointer(card, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 100 })
    dispatchPointer(carousel, 'pointermove', {
      pointerId: 1,
      clientX: 100 - displacement,
      clientY: 100,
    })
    dispatchPointer(carousel, 'pointerup', {
      pointerId: 1,
      clientX: 100 - displacement,
      clientY: 100,
    })
    fireEvent.click(card, { detail: 1 })

    expect(screen.getByRole('button', { name: 'Show word' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('img', { name: 'Picture card' })).toHaveAttribute(
      'src',
      expect.stringContaining(
        shouldNavigate ? '/assets/images/mat.png' : '/assets/images/sat.png',
      ),
    )
  })

  it('treats a 10 px movement as a tap but rejects 11 px and diagonal swipes', async () => {
    stubDeck(createCards('sat', 'mat', 'cat'))

    render(<App deckUrl="/lang/english/deck.json" language="english" />)

    const nextButton = await screen.findByRole('button', { name: 'Next card' })
    const carousel = screen.getByRole('group', { name: 'Flashcard carousel' })
    const sendGesture = (pointerId: number, x: number, y: number) => {
      dispatchPointer(nextButton, 'pointerdown', {
        pointerId,
        clientX: 100,
        clientY: 100,
      })
      dispatchPointer(carousel, 'pointermove', {
        pointerId,
        clientX: x,
        clientY: y,
      })
      dispatchPointer(carousel, 'pointerup', {
        pointerId,
        clientX: x,
        clientY: y,
      })
      fireEvent.click(nextButton, { detail: 1 })
    }

    sendGesture(1, 110, 100)
    completeVisualTransition()
    expect(screen.getByRole('img', { name: 'Picture card' })).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/mat.png'),
    )

    sendGesture(2, 111, 100)
    expect(screen.getByRole('img', { name: 'Picture card' })).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/mat.png'),
    )

    sendGesture(3, 140, 140)
    expect(screen.getByRole('img', { name: 'Picture card' })).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/mat.png'),
    )
  })

  it('cancels pointercancel and multi-pointer gestures without flipping', async () => {
    stubDeck(createCards('sat', 'mat'))

    render(<App deckUrl="/lang/english/deck.json" language="english" />)

    const card = await screen.findByRole('button', { name: 'Show word' })
    const carousel = screen.getByRole('group', { name: 'Flashcard carousel' })
    dispatchPointer(card, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 100 })
    dispatchPointer(carousel, 'pointermove', { pointerId: 1, clientX: 50, clientY: 100 })
    dispatchPointer(carousel, 'pointercancel', { pointerId: 1, clientX: 50, clientY: 100 })
    fireEvent.click(card, { detail: 1 })
    expect(screen.getByRole('button', { name: 'Show word' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    dispatchPointer(card, 'pointerdown', { pointerId: 2, clientX: 100, clientY: 100 })
    dispatchPointer(carousel, 'pointerdown', {
      pointerId: 3,
      clientX: 100,
      clientY: 100,
      isPrimary: false,
    })
    dispatchPointer(carousel, 'pointerup', { pointerId: 2, clientX: 50, clientY: 100 })
    fireEvent.click(card, { detail: 1 })
    expect(screen.getByRole('button', { name: 'Show word' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('omits peeks for a one-card deck and keeps swipes inert', async () => {
    stubDeck([{
      card_id: 'sat',
      target_word: 'sat',
      image: 'assets/images/sat.png',
      audio: 'lang/english/audios/sat.mp3',
    }])

    render(<App deckUrl="/lang/english/deck.json" language="english" />)

    expect(await screen.findByRole('button', { name: 'Show word' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Previous card' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next card' })).not.toBeInTheDocument()

    const card = screen.getByRole('button', { name: 'Show word' })
    const carousel = screen.getByRole('group', { name: 'Flashcard carousel' })
    dispatchPointer(card, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 100 })
    dispatchPointer(carousel, 'pointermove', { pointerId: 1, clientX: 50, clientY: 100 })
    dispatchPointer(carousel, 'pointerup', { pointerId: 1, clientX: 50, clientY: 100 })
    fireEvent.click(card, { detail: 1 })

    expect(screen.getByRole('button', { name: 'Show word' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('ignores rapid mixed flip and navigation actions until each transition finishes', async () => {
    class MockAudio {
      src = ''
      currentTime = 0
      error: MediaError | null = null
      onerror: (() => void) | null = null
      onplaying: (() => void) | null = null
      onended: (() => void) | null = null
      readonly play = vi.fn(async () => undefined)
      readonly pause = vi.fn()
      readonly load = vi.fn()
      readonly removeAttribute = vi.fn((name: string) => {
        if (name === 'src') this.src = ''
      })
    }

    vi.stubGlobal('Audio', MockAudio)
    stubDeck(createCards('sat', 'mat', 'cat'))
    render(<App deckUrl="/lang/english/deck.json" language="english" />)

    const flipButton = await screen.findByRole('button', { name: 'Show word' })
    fireEvent.click(flipButton)
    fireEvent.click(screen.getByRole('button', { name: 'Show picture' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next card' }))
    expect(screen.getByRole('button', { name: 'Show picture' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    act(() => {
      const flipper = flipButton.querySelector('.card-flipper')
      if (!flipper) throw new Error('The card flipper is unavailable.')
      flipper.dispatchEvent(new Event('transitioncancel', { bubbles: true }))
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next card' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next card' }))
    expect(screen.getByRole('img', { name: 'Picture card' })).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/mat.png'),
    )

    const card = screen.getByRole('button', { name: 'Show word' })
    act(() => {
      card.dispatchEvent(new Event('animationcancel', { bubbles: true }))
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next card' }))
    expect(screen.getByRole('img', { name: 'Picture card' })).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/cat.png'),
    )
  })

  it('commits flips and navigation immediately without locking in reduced-motion mode', async () => {
    class MockAudio {
      src = ''
      currentTime = 0
      error: MediaError | null = null
      onerror: (() => void) | null = null
      onplaying: (() => void) | null = null
      onended: (() => void) | null = null
      readonly play = vi.fn(async () => undefined)
      readonly pause = vi.fn()
      readonly load = vi.fn()
      readonly removeAttribute = vi.fn((name: string) => {
        if (name === 'src') this.src = ''
      })
    }

    vi.stubGlobal('Audio', MockAudio)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    stubDeck(createCards('sat', 'mat', 'cat'))
    render(<App deckUrl="/lang/english/deck.json" language="english" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Show word' }))
    expect(
      screen.getByRole('button', { name: 'Show picture' }),
    ).not.toHaveAttribute('data-transition')
    fireEvent.click(screen.getByRole('button', { name: 'Show picture' }))
    const nextButton = screen.getByRole('button', { name: 'Next card' })
    fireEvent.click(nextButton)
    fireEvent.click(nextButton)

    expect(screen.getByRole('img', { name: 'Picture card' })).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/cat.png'),
    )
    expect(
      screen.getByRole('button', { name: 'Show word' }),
    ).not.toHaveAttribute('data-transition')
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
            image: 'assets/images/sat.png',
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
      asset: 'assets/images/sat.png',
    })
  })

  it('restores a saved card and face without starting pronunciation', async () => {
    window.history.replaceState(
      null,
      '',
      '/?cr_lang=english&cr_user_id=user-one',
    )
    localStorage.setItem(
      'flashcards:progress:v1:english:user-one',
      JSON.stringify({ schema_version: 1, card_id: 'mat', face: 'word' }),
    )
    const audioConstructor = vi.fn()
    vi.stubGlobal('Audio', class {
      constructor() {
        audioConstructor()
      }
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          schema_version: 1,
          language: 'english',
          cards: [
            {
              card_id: 'sat',
              target_word: 'sat',
              image: 'assets/images/sat.png',
              audio: 'lang/english/audios/sat.mp3',
            },
            {
              card_id: 'mat',
              target_word: 'mat',
              image: 'assets/images/mat.png',
              audio: 'lang/english/audios/mat.mp3',
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

    expect(await screen.findByRole('button', { name: 'Show picture' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('mat')).toBeVisible()
    expect(document.querySelector('.card-image')).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/images/mat.png'),
    )
    expect(audioConstructor).not.toHaveBeenCalled()
  })

  it('saves flips for the launch user and leaves the card usable when storage fails', async () => {
    window.history.replaceState(
      null,
      '',
      '/?cr_lang=english&cr_user_id=user-one',
    )
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled.', 'SecurityError')
    })
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
            image: 'assets/images/sat.png',
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

    render(<App deckUrl="/lang/english/deck.json" language="english" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Show word' }))

    expect(screen.getByRole('button', { name: 'Show picture' })).toBeVisible()
    expect(screen.getByText('sat')).toBeVisible()
    expect(warning).toHaveBeenCalledWith(
      'Learner progress could not be restored or saved.',
      { category: 'storage_unavailable' },
    )
  })

  it('does not restore progress from another user', async () => {
    localStorage.setItem(
      'flashcards:progress:v1:english:user-one',
      JSON.stringify({ schema_version: 1, card_id: 'sat', face: 'word' }),
    )
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
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
            image: 'assets/images/sat.png',
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

    window.history.replaceState(null, '', '/?cr_lang=english&cr_user_id=user-two')
    render(<App deckUrl="/lang/english/deck.json" language="english" />)
    expect(await screen.findByRole('button', { name: 'Show word' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('does not save progress when the container user is missing', async () => {
    window.history.replaceState(null, '', '/?cr_lang=english')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
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
            image: 'assets/images/sat.png',
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

    render(<App deckUrl="/lang/english/deck.json" language="english" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Show word' }))

    expect(screen.getByText('sat')).toBeVisible()
    expect(localStorage.length).toBe(0)
  })

  it('discards saved progress for a card outside the current order', async () => {
    window.history.replaceState(
      null,
      '',
      '/?cr_lang=english&cr_user_id=user-one',
    )
    const key = 'flashcards:progress:v1:english:user-one'
    localStorage.setItem(
      key,
      JSON.stringify({ schema_version: 1, card_id: 'missing', face: 'word' }),
    )
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
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
            image: 'assets/images/sat.png',
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

    render(<App deckUrl="/lang/english/deck.json" language="english" />)

    expect(await screen.findByRole('button', { name: 'Show word' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(localStorage.getItem(key)).toBeNull()
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
            image: 'assets/images/sat.png',
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

  it('flips with one pronunciation per reveal and completes 20 repeated cycles', async () => {
    class MockAudio {
      src = ''
      currentTime = 0
      error: MediaError | null = null
      onerror: (() => void) | null = null
      readonly play = vi.fn(async () => undefined)
      readonly pause = vi.fn()
      readonly load = vi.fn()
      readonly removeAttribute = vi.fn((name: string) => {
        if (name === 'src') this.src = ''
      })
    }

    let audio: MockAudio | undefined
    vi.stubGlobal('Audio', class extends MockAudio {
      constructor() {
        super()
        audio = this
      }
    })
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
            image: 'assets/images/sat.png',
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

    render(<App deckUrl="/lang/english/deck.json" language="english" />)

    const flipButton = await screen.findByRole('button', { name: 'Show word' })
    expect(flipButton).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('sat')).toHaveAttribute('aria-hidden', 'true')

    for (let cycle = 0; cycle < 20; cycle += 1) {
      fireEvent.click(flipButton)
      completeVisualTransition()

      expect(screen.getByRole('button', { name: 'Show picture' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(screen.getByText('sat')).toHaveAttribute('aria-hidden', 'false')
      expect(audio?.play).toHaveBeenCalledTimes(cycle + 1)

      fireEvent.click(screen.getByRole('button', { name: 'Show picture' }))
      completeVisualTransition()

      expect(screen.getByRole('button', { name: 'Show word' })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
      expect(screen.getByText('sat')).toHaveAttribute('aria-hidden', 'true')
      expect(audio?.src).toBe('')
      expect(audio?.currentTime).toBe(0)
    }

    expect(audio?.play).toHaveBeenCalledTimes(20)
    expect(audio?.pause).toHaveBeenCalledTimes(40)
  })

  it('keeps the word visible and reports retryable audio failure', async () => {
    class MockAudio {
      src = ''
      currentTime = 0
      error: MediaError | null = null
      onerror: (() => void) | null = null
      onplaying: (() => void) | null = null
      onended: (() => void) | null = null
      readonly play = vi.fn()
        .mockRejectedValueOnce(new Error('Playback is not allowed.'))
        .mockRejectedValueOnce(new Error('Playback is still unavailable.'))
        .mockResolvedValueOnce(undefined)
      readonly pause = vi.fn()
      readonly load = vi.fn()
      readonly removeAttribute = vi.fn((name: string) => {
        if (name === 'src') this.src = ''
      })
    }

    let audio: MockAudio | undefined
    vi.stubGlobal('Audio', class extends MockAudio {
      constructor() {
        super()
        audio = this
      }
    })
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
            image: 'assets/images/sat.png',
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
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<App deckUrl="/lang/english/deck.json" language="english" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Show word' }))

    expect(await screen.findByText('Audio unavailable')).toBeVisible()
    expect(screen.getByText('sat')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Show picture' })).toBeEnabled()
    const replayButton = screen.getByRole('button', { name: 'Retry word audio' })
    expect(replayButton).toHaveAttribute('data-playback-state', 'unavailable')
    expect(errorSpy).toHaveBeenCalledWith('Pronunciation audio unavailable.', {
      category: 'audio',
      cardId: 'sat',
      asset: expect.stringContaining('/lang/english/audios/sat.mp3'),
    })

    fireEvent.click(replayButton)
    await waitFor(() => {
      expect(audio?.play).toHaveBeenCalledTimes(2)
      expect(audio?.pause).toHaveBeenCalledTimes(4)
    })
    expect(screen.getByText('Audio unavailable')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry word audio' })).toHaveAttribute(
      'data-playback-state',
      'unavailable',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retry word audio' }))

    await waitFor(() => {
      expect(screen.queryByText('Audio unavailable')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Show picture' })).toBeVisible()
    expect(screen.getByText('sat')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Play word again' })).toHaveAttribute(
      'data-playback-state',
      'playing',
    )
    expect(audio?.play).toHaveBeenCalledTimes(3)
  })

  it('replays pronunciation without flipping and returns to idle when it ends', async () => {
    class MockAudio {
      src = ''
      currentTime = 0
      error: MediaError | null = null
      onerror: (() => void) | null = null
      onplaying: (() => void) | null = null
      onended: (() => void) | null = null
      readonly play = vi.fn(async () => {
        this.onplaying?.()
      })
      readonly pause = vi.fn()
      readonly load = vi.fn()
      readonly removeAttribute = vi.fn((name: string) => {
        if (name === 'src') this.src = ''
      })
    }

    let audio: MockAudio | undefined
    vi.stubGlobal('Audio', class extends MockAudio {
      constructor() {
        super()
        audio = this
      }
    })
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
            image: 'assets/images/sat.png',
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

    render(<App deckUrl="/lang/english/deck.json" language="english" />)
    expect(screen.queryByRole('button', { name: 'Play word again' })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Show word' }))

    const replayButton = await screen.findByRole('button', { name: 'Play word again' })
    expect(replayButton).toHaveAttribute('data-playback-state', 'playing')
    expect(replayButton.closest('.card-box')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show picture' })).toBeVisible()

    audio!.currentTime = 2
    fireEvent.click(replayButton)

    await waitFor(() => {
      expect(audio?.play).toHaveBeenCalledTimes(2)
    })
    expect(audio?.currentTime).toBe(0)
    expect(screen.getByRole('button', { name: 'Show picture' })).toBeVisible()
    expect(screen.getByText('sat')).toBeVisible()
    expect(screen.getByText('Playing pronunciation')).toBeVisible()

    audio?.onended?.()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Play word again' })).toHaveAttribute(
        'data-playback-state',
        'idle',
      )
    })
    expect(screen.getByText('Replay')).toBeVisible()
    expect(screen.queryByText('Playing pronunciation')).not.toBeInTheDocument()
  })
})
