export interface SavedProgress {
  schema_version: 1
  card_id: string
  face: 'image' | 'word'
}

export interface SavedStickerCollection {
  schema_version: 1
  collectedStickerIds: string[]
  flipsSinceLastSticker: number
}

function reportProgressIssue(category: string) {
  console.warn('Learner progress could not be restored or saved.', { category })
}

export function createProgressStorageKey(search: string, language: string): string | null {
  const params = new URLSearchParams(search)
  const userIds = params.getAll('cr_user_id')
  const languages = params.getAll('cr_lang')

  if (
    userIds.length !== 1 ||
    languages.length !== 1 ||
    !userIds[0]?.trim() ||
    languages[0] !== language
  ) {
    reportProgressIssue('missing_or_invalid_launch_identity')
    return null
  }

  return [
    'flashcards',
    'progress',
    'v1',
    encodeURIComponent(languages[0]),
    encodeURIComponent(userIds[0]),
  ].join(':')
}

export function createStickerStorageKey(search: string, language: string): string | null {
  const params = new URLSearchParams(search)
  const userIds = params.getAll('cr_user_id')
  const languages = params.getAll('cr_lang')

  if (
    userIds.length !== 1 ||
    languages.length !== 1 ||
    !userIds[0]?.trim() ||
    languages[0] !== language
  ) {
    reportProgressIssue('missing_or_invalid_launch_identity')
    return null
  }

  return [
    'flashcards',
    'stickers',
    'v1',
    encodeURIComponent(languages[0]),
    encodeURIComponent(userIds[0]),
  ].join(':')
}

function isSavedProgress(value: unknown): value is SavedProgress {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const progress = value as Record<string, unknown>
  return (
    Object.keys(progress).length === 3 &&
    progress.schema_version === 1 &&
    typeof progress.card_id === 'string' &&
    progress.card_id.trim().length > 0 &&
    (progress.face === 'image' || progress.face === 'word')
  )
}

export function readSavedProgress(key: string): SavedProgress | null {
  let serialized: string | null
  try {
    serialized = window.localStorage.getItem(key)
  } catch {
    reportProgressIssue('storage_unavailable')
    return null
  }

  if (serialized === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    discardSavedProgress(key, 'invalid_saved_state')
    return null
  }

  if (!isSavedProgress(parsed)) {
    discardSavedProgress(key, 'invalid_saved_state')
    return null
  }

  return parsed
}

export function discardSavedProgress(key: string, category = 'stale_saved_state') {
  try {
    window.localStorage.removeItem(key)
  } catch {
    reportProgressIssue('storage_unavailable')
    return
  }

  reportProgressIssue(category)
}

export function saveProgress(key: string | null, cardId: string, face: SavedProgress['face']) {
  if (!key) return

  const progress: SavedProgress = {
    schema_version: 1,
    card_id: cardId,
    face,
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(progress))
  } catch {
    reportProgressIssue('storage_unavailable')
  }
}

function isSavedStickerCollection(value: unknown): value is SavedStickerCollection {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const collection = value as Record<string, unknown>
  return (
    Object.keys(collection).length === 3 &&
    collection.schema_version === 1 &&
    Array.isArray(collection.collectedStickerIds) &&
    collection.collectedStickerIds.every((id) => typeof id === 'string') &&
    typeof collection.flipsSinceLastSticker === 'number' &&
    collection.flipsSinceLastSticker >= 0
  )
}

export function readStickerCollection(key: string): SavedStickerCollection | null {
  let serialized: string | null
  try {
    serialized = window.localStorage.getItem(key)
  } catch {
    reportProgressIssue('storage_unavailable')
    return null
  }

  if (serialized === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    discardStickerCollection(key, 'invalid_saved_stickers')
    return null
  }

  if (!isSavedStickerCollection(parsed)) {
    discardStickerCollection(key, 'invalid_saved_stickers')
    return null
  }

  return parsed
}

export function discardStickerCollection(key: string, category = 'stale_saved_stickers') {
  try {
    window.localStorage.removeItem(key)
  } catch {
    reportProgressIssue('storage_unavailable')
    return
  }

  reportProgressIssue(category)
}

export function saveStickerCollection(
  key: string | null,
  collectedIds: ReadonlyArray<string>,
  flipsSince: number,
) {
  if (!key) return

  const collection: SavedStickerCollection = {
    schema_version: 1,
    collectedStickerIds: [...collectedIds],
    flipsSinceLastSticker: flipsSince,
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(collection))
  } catch {
    reportProgressIssue('storage_unavailable')
  }
}
