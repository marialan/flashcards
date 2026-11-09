import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createProgressStorageKey,
  readSavedProgress,
  saveProgress,
} from './progress'

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
