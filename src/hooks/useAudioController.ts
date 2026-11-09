import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AudioPlaybackError,
  createAudioController,
  type AudioController,
} from '../audio/audioController'
import type { Flashcard } from '../data/deck'

type AudioStatus = 'idle' | 'playing' | 'unavailable'

export function useAudioController() {
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle')
  const audioControllerRef = useRef<AudioController | null>(null)
  const audioRequestIdRef = useRef(0)
  const audioCardIdRef = useRef<string | null>(null)

  const reportAudioFailure = useCallback((error: AudioPlaybackError) => {
    console.error('Pronunciation audio unavailable.', {
      category: error.category,
      cardId: audioCardIdRef.current,
      asset: error.asset,
    })
    setAudioStatus('unavailable')
  }, [])

  const setAudioPlaybackStatus = useCallback((status: 'idle' | 'playing') => {
    setAudioStatus((current) => {
      if (status === 'idle' && current !== 'playing') return current
      return status
    })
  }, [])

  const stopAudio = useCallback(() => {
    audioRequestIdRef.current += 1
    audioControllerRef.current?.stop()
  }, [])

  const resetAudio = useCallback(() => {
    stopAudio()
    setAudioStatus('idle')
  }, [stopAudio])

  const playPronunciation = useCallback((card: Flashcard) => {
    const requestId = ++audioRequestIdRef.current
    audioCardIdRef.current = card.card_id

    if (!audioControllerRef.current) {
      audioControllerRef.current = createAudioController(
        reportAudioFailure,
        setAudioPlaybackStatus,
      )
    }

    const audioController = audioControllerRef.current
    setAudioStatus((current) =>
      current === 'playing' ? 'idle' : current,
    )

    const asset = new URL(card.audio, document.baseURI).href
    void audioController.play(asset).then(
      () => {
        if (requestId !== audioRequestIdRef.current) return
        setAudioStatus('playing')
      },
      (error: unknown) => {
        if (error instanceof AudioPlaybackError) return

        console.error('Pronunciation playback failed unexpectedly.', {
          category: 'audio',
          cardId: card.card_id,
          asset,
          error,
        })
        setAudioStatus('unavailable')
      },
    )
  }, [reportAudioFailure, setAudioPlaybackStatus])

  useEffect(
    () => () => {
      audioRequestIdRef.current += 1
      audioControllerRef.current?.dispose()
    },
    [],
  )

  return {
    audioStatus,
    playPronunciation,
    resetAudio,
    stopAudio,
  }
}

export default useAudioController
