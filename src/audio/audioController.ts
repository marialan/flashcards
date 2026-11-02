export class AudioPlaybackError extends Error {
  readonly category = 'audio'
  readonly asset: string

  constructor(
    asset: string,
    cause: unknown,
  ) {
    super('Pronunciation audio could not be played.', { cause })
    this.name = 'AudioPlaybackError'
    this.asset = asset
  }
}

export interface AudioController {
  play(asset: string): Promise<void>
  stop(): void
  dispose(): void
}

export function createAudioController(
  onFailure: (error: AudioPlaybackError) => void,
): AudioController {
  const audio = new Audio()
  let requestId = 0
  let disposed = false

  function cancelCurrentPlayback() {
    requestId += 1
    audio.onerror = null
    audio.pause()
    audio.currentTime = 0
    audio.removeAttribute('src')
    audio.load()
  }

  return {
    async play(asset) {
      if (disposed) {
        throw new AudioPlaybackError(asset, new Error('Audio controller is disposed.'))
      }

      const currentRequestId = ++requestId
      let failureReported = false
      const reportFailure = (cause: unknown) => {
        if (failureReported) return
        failureReported = true
        onFailure(new AudioPlaybackError(asset, cause))
      }

      audio.pause()
      audio.currentTime = 0
      audio.src = asset
      audio.onerror = () => {
        if (currentRequestId !== requestId || disposed) return
        const cause = audio.error ?? new Error('Media element reported playback failure.')
        cancelCurrentPlayback()
        reportFailure(cause)
      }

      try {
        audio.load()
        await audio.play()
      } catch (cause) {
        if (currentRequestId !== requestId || disposed) return

        const error = new AudioPlaybackError(asset, cause)
        cancelCurrentPlayback()
        if (!failureReported) {
          failureReported = true
          onFailure(error)
        }
        throw error
      }
    },
    stop() {
      if (!disposed) cancelCurrentPlayback()
    },
    dispose() {
      if (disposed) return
      cancelCurrentPlayback()
      disposed = true
    },
  }
}
