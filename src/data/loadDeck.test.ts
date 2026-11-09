import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeckLoadError, loadDeck } from './loadDeck'

const deckSource = JSON.stringify({
  schema_version: 1,
  language: 'english',
  cards: [{
    card_id: 'sat',
    target_word: 'sat',
    image: 'assets/images/sat.png',
    audio: 'lang/english/audios/sat.mp3',
  }],
  card_order: ['sat'],
})

class SuccessfulImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  set src(value: string) {
    if (value) queueMicrotask(() => this.onload?.())
  }
}

describe('loadDeck', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('loads HTTP deck data and waits for the first ordered image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => deckSource,
    }))
    vi.stubGlobal('Image', SuccessfulImage)

    const result = await loadDeck('/lang/english/deck.json', 'english', {
      signal: new AbortController().signal,
    })

    expect(result.deck.card_order).toEqual(['sat'])
    expect(result.initialImageAvailable).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/lang/english/deck.json',
      expect.objectContaining({ signal: expect.any(AbortSignal), redirect: 'error' }),
    )
  })

  it.each([0, 200])('uses XHR and accepts status %i on file URLs', async (responseStatus) => {
    const xhr = vi.fn(class {
      status = responseStatus
      responseText = deckSource
      timeout = 0
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      ontimeout: (() => void) | null = null
      onabort: (() => void) | null = null
      open = vi.fn()
      send = vi.fn(() => queueMicrotask(() => this.onload?.()))
      abort = vi.fn(() => this.onabort?.())
    })
    vi.stubGlobal('XMLHttpRequest', xhr)
    vi.stubGlobal('Image', SuccessfulImage)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadDeck('file:///app/lang/english/deck.json', 'english', {
      signal: new AbortController().signal,
      assetBaseUrl: 'file:///app/index.html',
    })

    expect(result.initialImageAvailable).toBe(true)
    expect(xhr).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects invalid deck data explicitly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{',
    }))

    await expect(loadDeck('/deck.json', 'english', {
      signal: new AbortController().signal,
    })).rejects.toMatchObject({
      category: 'invalid_deck',
    })
  })

  it('does not request a deck from another origin', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadDeck('https://outside.test/deck.json', 'english', {
      signal: new AbortController().signal,
    })).rejects.toMatchObject({ category: 'request' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('bounds a stalled request by the configured timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))

    const pending = loadDeck('/deck.json', 'english', {
      signal: new AbortController().signal,
      timeoutMs: 200,
    })
    const result = expect(pending).rejects.toBeInstanceOf(DeckLoadError)
    await vi.advanceTimersByTimeAsync(200)
    await result
    await expect(pending).rejects.toMatchObject({ category: 'timeout' })
  })

  it('aborts an obsolete request without converting cancellation to failure', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))
    const controller = new AbortController()
    const pending = loadDeck('/deck.json', 'english', { signal: controller.signal })

    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('settles with an unavailable initial image instead of stranding deck loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => deckSource,
    }))
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(value: string) {
        if (value) queueMicrotask(() => this.onerror?.())
      }
    })

    const result = await loadDeck('/deck.json', 'english', {
      signal: new AbortController().signal,
    })

    expect(result.deck.cards).toHaveLength(1)
    expect(result.initialImageAvailable).toBe(false)
  })

  it('bounds a stalled first image and still settles deck loading', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => deckSource,
    }))
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {}
    })

    const pending = loadDeck('/deck.json', 'english', {
      signal: new AbortController().signal,
      timeoutMs: 200,
    })
    const result = pending.then((loaded) => loaded)
    await vi.advanceTimersByTimeAsync(200)

    await expect(result).resolves.toMatchObject({ initialImageAvailable: false })
  })
})
