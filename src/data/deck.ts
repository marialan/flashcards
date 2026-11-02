export interface Flashcard {
  card_id: string
  target_word: string
  image: string
  audio: string
}

export interface FlashcardDeck {
  schema_version: 1
  language: string
  cards: Flashcard[]
  card_order: string[]
}

export class DeckValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeckValidationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
  context: string,
) {
  const unexpectedKey = Object.keys(value).find((key) => !allowedKeys.includes(key))

  if (unexpectedKey !== undefined) {
    throw new DeckValidationError(`${context} contains unsupported field "${unexpectedKey}".`)
  }
}

function decodeAssetPath(path: string): string {
  let decodedPath = path

  for (let attempt = 0; attempt < 10; attempt += 1) {
    let nextPath: string

    try {
      nextPath = decodeURIComponent(decodedPath)
    } catch {
      throw new DeckValidationError(`Asset path is not valid URI encoding: ${path}`)
    }

    if (nextPath === decodedPath) {
      return decodedPath
    }

    decodedPath = nextPath
  }

  throw new DeckValidationError(`Asset path is excessively encoded: ${path}`)
}

function validateAssetPath(
  value: unknown,
  mediaType: 'image' | 'audio',
  language: string,
  cardId: string,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DeckValidationError(`Card "${cardId}" must have a nonblank ${mediaType} path.`)
  }

  const decodedPath = decodeAssetPath(value)
  const segments = decodedPath.split('/')

  if (
    /^[a-z][a-z\d+.-]*:/i.test(decodedPath) ||
    decodedPath.startsWith('/') ||
    decodedPath.includes('\\') ||
    decodedPath.includes('?') ||
    decodedPath.includes('#') ||
    segments.some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new DeckValidationError(`Card "${cardId}" has an unsafe ${mediaType} path: ${value}`)
  }

  const extension = decodedPath.slice(decodedPath.lastIndexOf('.') + 1).toLowerCase()
  const allowedExtensions =
    mediaType === 'image' ? ['png', 'jpg', 'jpeg', 'webp', 'svg'] : ['mp3', 'wav']

  if (!allowedExtensions.includes(extension)) {
    throw new DeckValidationError(`Card "${cardId}" has an unsupported ${mediaType} format.`)
  }

  if (mediaType === 'audio' && !decodedPath.startsWith(`lang/${language}/audios/`)) {
    throw new DeckValidationError(
      `Card "${cardId}" audio must be inside lang/${language}/audios/.`,
    )
  }

  return value
}

function requireNonblankString(value: unknown, field: string, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DeckValidationError(`${context} must have a nonblank ${field}.`)
  }

  return value
}

export function validateDeck(input: unknown, expectedLanguage: string): FlashcardDeck {
  if (!isRecord(input)) {
    throw new DeckValidationError('Deck must be a JSON object.')
  }

  assertKeys(input, ['schema_version', 'language', 'cards', 'card_order'], 'Deck')

  if (input.schema_version !== 1) {
    throw new DeckValidationError('Deck schema_version must be 1.')
  }

  const language = requireNonblankString(input.language, 'language', 'Deck')

  if (language !== expectedLanguage) {
    throw new DeckValidationError(`Deck language "${language}" does not match "${expectedLanguage}".`)
  }

  if (!Array.isArray(input.cards) || input.cards.length === 0) {
    throw new DeckValidationError('Deck cards must be a nonempty array.')
  }

  if (!Array.isArray(input.card_order) || input.card_order.length === 0) {
    throw new DeckValidationError('Deck card_order must be a nonempty array.')
  }

  const cards = input.cards.map((value, index): Flashcard => {
    const context = `Card at index ${index}`

    if (!isRecord(value)) {
      throw new DeckValidationError(`${context} must be a JSON object.`)
    }

    assertKeys(value, ['card_id', 'target_word', 'image', 'audio'], context)

    const cardId = requireNonblankString(value.card_id, 'card_id', context)
    const targetWord = requireNonblankString(value.target_word, 'target_word', `Card "${cardId}"`)

    return {
      card_id: cardId,
      target_word: targetWord,
      image: validateAssetPath(value.image, 'image', language, cardId),
      audio: validateAssetPath(value.audio, 'audio', language, cardId),
    }
  })

  const cardIds = cards.map(({ card_id }) => card_id)

  if (new Set(cardIds).size !== cardIds.length) {
    throw new DeckValidationError('Deck card_id values must be unique.')
  }

  const cardOrder = input.card_order.map((value, index) =>
    requireNonblankString(value, 'card_order entry', `Deck card_order entry ${index}`),
  )

  if (new Set(cardOrder).size !== cardOrder.length) {
    throw new DeckValidationError('Deck card_order entries must be unique.')
  }

  const knownCardIds = new Set(cardIds)

  if (cardOrder.some((cardId) => !knownCardIds.has(cardId))) {
    throw new DeckValidationError('Every card_order entry must reference a defined card.')
  }

  if (cardOrder.length !== cardIds.length) {
    throw new DeckValidationError('Every defined card must appear in card_order.')
  }

  return {
    schema_version: 1,
    language,
    cards,
    card_order: cardOrder,
  }
}

export function parseDeckJson(source: string, expectedLanguage: string): FlashcardDeck {
  let parsed: unknown

  try {
    parsed = JSON.parse(source)
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new DeckValidationError('Deck file contains malformed JSON.')
    }

    throw error
  }

  return validateDeck(parsed, expectedLanguage)
}
