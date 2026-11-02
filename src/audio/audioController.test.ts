import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioPlaybackError, createAudioController } from './audioController'

class MockAudio {
  src = ''
  currentTime = 0
  error: MediaError | null = null
  onerror: (() => void) | null = null
  readonly playTimes: number[] = []
  playCount = 0
  pauseCount = 0
  loadCount = 0
  playing = false
  activePlays = 0
  maxConcurrentPlays = 0
  playResult: () => Promise<void> = async () => undefined

  pause() {
    this.pauseCount += 1
    if (this.playing) this.activePlays -= 1
    this.playing = false
  }

  load() {
    this.loadCount += 1
  }

  removeAttribute(name: string) {
    if (name === 'src') this.src = ''
  }

  async play() {
    this.playCount += 1
    this.playTimes.push(this.currentTime)
    this.playing = true
    this.activePlays += 1
    this.maxConcurrentPlays = Math.max(this.maxConcurrentPlays, this.activePlays)
    try {
      await this.playResult()
    } catch (error) {
      this.pause()
      throw error
    }
  }

  fail() {
    this.error = null
    this.onerror?.()
  }
}

describe('createAudioController', () => {
  let audio: MockAudio

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function createController(onFailure = vi.fn()) {
    vi.stubGlobal('Audio', class extends MockAudio {
      constructor() {
        super()
        audio = this
      }
    })
    return { controller: createAudioController(onFailure), onFailure }
  }

  it('restarts the same audio element from the beginning without overlapping playback', async () => {
    const { controller } = createController()
    const asset = 'file:///app/lang/english/audios/sat.mp3'

    await controller.play(asset)
    audio.currentTime = 2.5
    await controller.play(asset)

    expect(audio.playCount).toBe(2)
    expect(audio.playTimes).toEqual([0, 0])
    expect(audio.pauseCount).toBe(2)
    expect(audio.src).toBe(asset)
    expect(audio.maxConcurrentPlays).toBe(1)
  })

  it('cancels pending playback and ignores its stale rejection', async () => {
    let rejectPlay: ((reason: Error) => void) | undefined
    const { controller, onFailure } = createController()
    audio.playResult = () => new Promise((_, reject) => {
      rejectPlay = reject
    })

    const pending = controller.play('/lang/english/audios/sat.mp3')
    controller.stop()
    rejectPlay?.(new Error('Playback was aborted.'))

    await expect(pending).resolves.toBeUndefined()
    expect(audio.src).toBe('')
    expect(audio.currentTime).toBe(0)
    expect(onFailure).not.toHaveBeenCalled()
  })

  it('reports a rejected play as an explicit failure and allows a retry', async () => {
    const { controller, onFailure } = createController()
    const asset = '/lang/english/audios/sat.mp3'
    audio.playResult = vi.fn()
      .mockRejectedValueOnce(new Error('Playback is not allowed.'))
      .mockResolvedValueOnce(undefined)

    await expect(controller.play(asset)).rejects.toMatchObject({
      name: 'AudioPlaybackError',
      category: 'audio',
      asset,
    })
    expect(onFailure).toHaveBeenCalledOnce()
    expect(onFailure).toHaveBeenCalledWith(expect.any(AudioPlaybackError))

    await expect(controller.play(asset)).resolves.toBeUndefined()
    expect(audio.playCount).toBe(2)
    expect(onFailure).toHaveBeenCalledOnce()
  })

  it('reports asynchronous media errors once and ignores errors from cancelled requests', async () => {
    const { controller, onFailure } = createController()
    const asset = '/lang/english/audios/sat.mp3'

    await controller.play(asset)
    audio.fail()
    audio.fail()

    expect(onFailure).toHaveBeenCalledOnce()
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({
      category: 'audio',
      asset,
    }))

    await controller.play(asset)
    controller.stop()
    audio.fail()
    expect(onFailure).toHaveBeenCalledOnce()
  })

  it('cancels playback and removes media resources when disposed', async () => {
    const { controller } = createController()
    await controller.play('/lang/english/audios/sat.mp3')

    controller.dispose()

    expect(audio.src).toBe('')
    expect(audio.currentTime).toBe(0)
    expect(audio.onerror).toBeNull()
    expect(() => controller.stop()).not.toThrow()
    await expect(controller.play('/lang/english/audios/sat.mp3')).rejects.toBeInstanceOf(
      AudioPlaybackError,
    )
  })
})
