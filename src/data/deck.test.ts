/// <reference types="node" />

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DeckValidationError, parseDeckJson, validateDeck } from './deck'

const publicRoot = resolve(process.cwd(), 'public')
const englishDeckSource = await readFile(
  resolve(publicRoot, 'lang', 'english', 'deck.json'),
  'utf8',
)

function card(cardId: string, targetWord = cardId) {
  return {
    card_id: cardId,
    target_word: targetWord,
    image: `lang/english/images/${cardId}.png`,
    audio: `lang/english/audios/${cardId}.mp3`,
  }
}

function validDeck() {
  return {
    schema_version: 1,
    language: 'english',
    cards: [card('one'), card('two')],
    card_order: ['one', 'two'],
  }
}

describe('flashcard deck contract', () => {
  it('preserves the supplied English card order and matching media references', () => {
    const deck = parseDeckJson(englishDeckSource, 'english')

    expect(deck.card_order).toEqual(['sat', 'mat', 'cat'])
    expect(deck.cards.map(({ target_word }) => target_word)).toEqual(['sat', 'mat', 'cat'])
    expect(deck.cards.map(({ card_id }) => card_id)).toEqual(deck.card_order)
    expect(deck.cards.map(({ image, audio }) => [image, audio])).toEqual([
      ['lang/english/images/sat.png', 'lang/english/audios/sat.mp3'],
      ['lang/english/images/mat.png', 'lang/english/audios/mat.mp3'],
      ['lang/english/images/cat.png', 'lang/english/audios/cat.mp3'],
    ])
  })

  it('preserves authored Unicode words and order independently of card definitions', () => {
    const deck = validateDeck(
      {
        schema_version: 1,
        language: 'english',
        cards: [card('first', 'Café'), card('second', 'Élan')],
        card_order: ['second', 'first'],
      },
      'english',
    )

    expect(deck.card_order).toEqual(['second', 'first'])
    expect(deck.cards.map(({ target_word }) => target_word)).toEqual(['Café', 'Élan'])
  })

  it('rejects malformed JSON and unsupported deck schemas', () => {
    expect(() => parseDeckJson('{', 'english')).toThrow(DeckValidationError)
    expect(() => validateDeck({ ...validDeck(), schema_version: 2 }, 'english')).toThrow(
      /schema_version must be 1/,
    )
  })

  it.each([
    ['empty cards', { ...validDeck(), cards: [] }],
    ['empty order', { ...validDeck(), card_order: [] }],
    ['duplicate card IDs', { ...validDeck(), cards: [card('one'), card('one')] }],
    ['duplicate order entries', { ...validDeck(), card_order: ['one', 'one'] }],
    ['unknown ordered ID', { ...validDeck(), card_order: ['one', 'missing'] }],
    ['unlisted card', { ...validDeck(), cards: [card('one'), card('two'), card('three')] }],
    ['blank word', { ...validDeck(), cards: [card('one', '  '), card('two')] }],
    ['missing field', { ...validDeck(), cards: [{ card_id: 'one' }, card('two')] }],
    ['language mismatch', { ...validDeck(), language: 'other' }],
  ])('rejects %s', (_description, deck) => {
    expect(() => validateDeck(deck, 'english')).toThrow(DeckValidationError)
  })

  it.each([
    'https://example.test/image.png',
    '//example.test/image.png',
    '/lang/english/images/one.png',
    'lang\\english\\images\\one.png',
    'lang/english/images/../one.png',
    'lang/english/images/%2e%2e/one.png',
    'lang/english/images/one.png?version=1',
    'lang/english/images/one.png#fragment',
  ])('rejects unsafe image path %s', (image) => {
    const deck = validDeck()
    deck.cards[0].image = image

    expect(() => validateDeck(deck, 'english')).toThrow(/unsafe image path/)
  })

  it('rejects unsupported extensions and audio outside the selected language pack', () => {
    const wrongExtension = validDeck()
    wrongExtension.cards[0].image = 'lang/english/images/one.gif'

    const wrongAudioLocation = validDeck()
    wrongAudioLocation.cards[0].audio = 'lang/other/audios/one.mp3'

    expect(() => validateDeck(wrongExtension, 'english')).toThrow(/unsupported image format/)
    expect(() => validateDeck(wrongAudioLocation, 'english')).toThrow(
      /audio must be inside lang\/english\/audios/,
    )
  })

  it('confirms supplied PNG and MP3 files exist and match their declared formats', async () => {
    for (const cardId of ['sat', 'mat', 'cat']) {
      const image = await readFile(
        resolve(publicRoot, 'lang', 'english', 'images', `${cardId}.png`),
      )
      const audio = await readFile(
        resolve(publicRoot, 'lang', 'english', 'audios', `${cardId}.mp3`),
      )
      const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      const hasPngSignature = pngSignature.every((byte, index) => image[index] === byte)
      const hasId3Tag =
        audio[0] === 0x49 && audio[1] === 0x44 && audio[2] === 0x33
      const hasMpegFrame = audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0

      expect(hasPngSignature, `${cardId}.png`).toBe(true)
      expect(hasId3Tag || hasMpegFrame, `${cardId}.mp3`).toBe(true)
    }
  })
})
