import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAudioController } from './useAudioController'

let playBehavior: (audio: MockAudio) => Promise<void>

class MockAudio {
  src = ''
  currentTime = 0
  error: MediaError | null = null
  onerror: (() => void) | null = null
  onplaying: (() => void) | null = null
  onended: (() => void) | null = null
  pause = vi.fn()
  load = vi.fn()

  async play() {
    await playBehavior(this)
  }

  removeAttribute(name: string) {
    if (name === 'src') this.src = ''
  }
}

describe('useAudioController', () => {
  let audio: MockAudio

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function stubAudio() {
    playBehavior = async (instance) => {
      instance.onplaying?.()
    }
    vi.stubGlobal('Audio', class extends MockAudio {
      constructor() {
        super()
        audio = this
      }
    })
  }

  const card = {
    card_id: 'sat',
    target_word: 'sat',
    image: 'assets/images/sat.png',
    audio: 'lang/english/audios/sat.mp3',
  }

  it('plays pronunciation, stops it, and disposes the controller on unmount', async () => {
    stubAudio()
    const { result, unmount } = renderHook(() => useAudioController())

    expect(result.current.audioStatus).toBe('idle')
    act(() => result.current.playPronunciation(card))

    await waitFor(() => expect(result.current.audioStatus).toBe('playing'))
    expect(audio.src).toBe(
      new URL(card.audio, document.baseURI).href,
    )

    act(() => result.current.stopAudio())
    expect(result.current.audioStatus).toBe('idle')
    expect(audio.src).toBe('')

    unmount()
    expect(audio.src).toBe('')
    expect(audio.load).toHaveBeenCalledTimes(3)
  })

  it('exposes playback failures and clears them after a successful retry', async () => {
    stubAudio()
    const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() => useAudioController())
    playBehavior = async () => {
      throw new Error('Playback is not allowed.')
    }

    act(() => result.current.playPronunciation(card))

    await waitFor(() => expect(result.current.audioStatus).toBe('unavailable'))
    expect(logError).toHaveBeenCalledWith(
      'Pronunciation audio unavailable.',
      expect.objectContaining({ category: 'audio', cardId: card.card_id }),
    )

    playBehavior = async (instance) => {
      instance.onplaying?.()
    }
    act(() => result.current.playPronunciation(card))

    await waitFor(() => expect(result.current.audioStatus).toBe('playing'))
  })

  it('ignores a playback completion after stop invalidates the request', async () => {
    stubAudio()
    let finishPlayback: (() => void) | undefined
    const { result } = renderHook(() => useAudioController())
    playBehavior = () => new Promise((resolve) => {
      finishPlayback = resolve
    })

    act(() => result.current.playPronunciation(card))
    act(() => result.current.stopAudio())

    await act(async () => {
      finishPlayback?.()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.audioStatus).toBe('idle')
  })
})
