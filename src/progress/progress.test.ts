import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createProgressStorageKey,
  readSavedProgress,
  saveProgress,
  createStickerStorageKey,
  readStickerCollection,
  saveStickerCollection,
  discardStickerCollection,
} from './progress'
import type { SavedStickerCollection } from './progress'

describe('learner progress', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('scopes saved progress to the container user and language', () => {
    const first = createProgressStorageKey(
      '?cr_lang=english&cr_user_id=user-one',
      'english',
    )
    const otherUser = createProgressStorageKey(
      '?cr_lang=english&cr_user_id=user-two',
      'english',
    )
    const otherLanguage = createProgressStorageKey(
      '?cr_lang=french&cr_user_id=user-one',
      'french',
    )

    expect(new Set([first, otherUser, otherLanguage]).size).toBe(3)
  })

  it('does not create an anonymous key when the container user is missing', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(createProgressStorageKey('?cr_lang=english', 'english')).toBeNull()
    expect(localStorage.length).toBe(0)
    expect(warning).toHaveBeenCalledWith(
      'Learner progress could not be restored or saved.',
      { category: 'missing_or_invalid_launch_identity' },
    )
  })

  it('stores only the version, card ID, and face', () => {
    const key = createProgressStorageKey(
      '?cr_lang=english&cr_user_id=private-user',
      'english',
    )

    saveProgress(key, 'mat', 'word')

    expect(JSON.parse(localStorage.getItem(key!)!)).toEqual({
      schema_version: 1,
      card_id: 'mat',
      face: 'word',
    })
    expect(localStorage.getItem(key!)).not.toContain('private-user')
  })

  it('discards malformed saved state and keeps the initial state available', () => {
    const key = createProgressStorageKey(
      '?cr_lang=english&cr_user_id=user-one',
      'english',
    )!
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    localStorage.setItem(key, '{')

    expect(readSavedProgress(key)).toBeNull()
    expect(localStorage.getItem(key)).toBeNull()
    expect(warning).toHaveBeenCalledWith(
      'Learner progress could not be restored or saved.',
      { category: 'invalid_saved_state' },
    )
  })

  it('keeps gameplay independent of localStorage write failures', () => {
    const key = createProgressStorageKey(
      '?cr_lang=english&cr_user_id=user-one',
      'english',
    )!
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled.', 'SecurityError')
    })

    expect(() => saveProgress(key, 'sat', 'word')).not.toThrow()
    expect(warning).toHaveBeenCalledWith(
      'Learner progress could not be restored or saved.',
      { category: 'storage_unavailable' },
    )
  })
})

describe('sticker collection persistence', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  describe('createStickerStorageKey', () => {
    it('creates a storage key with valid parameters', () => {
      const key = createStickerStorageKey('?cr_user_id=user123&cr_lang=english', 'english')
      expect(key).toContain('flashcards:stickers:v1')
      expect(key).toContain('english')
      expect(key).toContain('user123')
    })

    it('returns null if language is missing', () => {
      const key = createStickerStorageKey('?cr_user_id=user123', 'english')
      expect(key).toBeNull()
    })

    it('returns null if user id is missing', () => {
      const key = createStickerStorageKey('?cr_lang=english', 'english')
      expect(key).toBeNull()
    })

    it('returns null if languages do not match', () => {
      const key = createStickerStorageKey('?cr_user_id=user123&cr_lang=french', 'english')
      expect(key).toBeNull()
    })
  })

  describe('saveStickerCollection', () => {
    it('saves collection to localStorage', () => {
      const key = 'test-key'
      const collectedIds = ['sticker-1', 'sticker-2']
      const flipsSince = 3

      saveStickerCollection(key, collectedIds, flipsSince)

      const saved = localStorage.getItem(key)
      expect(saved).toBeDefined()

      const parsed = JSON.parse(saved!) as SavedStickerCollection
      expect(parsed.schema_version).toBe(1)
      expect(parsed.collectedStickerIds).toEqual(collectedIds)
      expect(parsed.flipsSinceLastSticker).toBe(flipsSince)
    })

    it('does nothing if key is null', () => {
      saveStickerCollection(null, ['sticker-1'], 0)
      expect(localStorage.length).toBe(0)
    })
  })

  describe('readStickerCollection', () => {
    it('reads valid collection from localStorage', () => {
      const key = 'test-key'
      const collection: SavedStickerCollection = {
        schema_version: 1,
        collectedStickerIds: ['sticker-1', 'sticker-2'],
        flipsSinceLastSticker: 5,
      }
      localStorage.setItem(key, JSON.stringify(collection))

      const read = readStickerCollection(key)
      expect(read).toEqual(collection)
    })

    it('returns null if key does not exist', () => {
      const read = readStickerCollection('nonexistent')
      expect(read).toBeNull()
    })

    it('returns null and discards invalid JSON', () => {
      const key = 'test-key'
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      localStorage.setItem(key, 'invalid json')

      const read = readStickerCollection(key)
      expect(read).toBeNull()
      expect(localStorage.getItem(key)).toBeNull()
      expect(warning).toHaveBeenCalled()
    })

    it('returns null and discards invalid schema', () => {
      const key = 'test-key'
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      localStorage.setItem(key, JSON.stringify({ wrong: 'schema' }))

      const read = readStickerCollection(key)
      expect(read).toBeNull()
      expect(localStorage.getItem(key)).toBeNull()
      expect(warning).toHaveBeenCalled()
    })
  })

  describe('discardStickerCollection', () => {
    it('removes collection from localStorage', () => {
      const key = 'test-key'
      localStorage.setItem(key, '{}')

      discardStickerCollection(key)
      expect(localStorage.getItem(key)).toBeNull()
    })
  })
})
