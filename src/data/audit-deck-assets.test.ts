/// <reference types="node" />

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { auditDeckAssets } from '../../scripts/audit-deck-assets.mjs'

const temporaryDirectories: string[] = []

async function createArtifact(imagePath = 'lang/english/images/one.png') {
  const root = await mkdtemp(resolve(tmpdir(), 'flashcards-audit-'))
  temporaryDirectories.push(root)
  await mkdir(resolve(root, 'lang', 'english', 'images'), { recursive: true })
  await mkdir(resolve(root, 'lang', 'english', 'audios'), { recursive: true })
  await writeFile(
    resolve(root, 'lang', 'english', 'deck.json'),
    JSON.stringify({
      schema_version: 1,
      language: 'english',
      cards: [
        {
          card_id: 'one',
          target_word: 'one',
          image: imagePath,
          audio: 'lang/english/audios/one.mp3',
        },
      ],
      card_order: ['one'],
    }),
  )
  await writeFile(
    resolve(root, 'lang', 'english', 'images', 'one.png'),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  )
  await writeFile(
    resolve(root, 'lang', 'english', 'audios', 'one.mp3'),
    Buffer.from('ID3'),
  )

  return root
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('packaged deck media audit', () => {
  it('accepts a deck when every media reference exists and matches its extension', async () => {
    const root = await createArtifact()

    await expect(auditDeckAssets(root)).resolves.toBe(1)
  })

  it('fails when a referenced asset is missing', async () => {
    const root = await createArtifact('lang/english/images/missing.png')

    await expect(auditDeckAssets(root)).rejects.toThrow(/Missing image asset/)
  })

  it('fails when asset bytes do not match the declared extension', async () => {
    const root = await createArtifact()
    await writeFile(
      resolve(root, 'lang', 'english', 'images', 'one.png'),
      Buffer.from('not a PNG'),
    )

    await expect(auditDeckAssets(root)).rejects.toThrow(/bytes do not match/)
  })

  it('rejects unsafe media paths before resolving the file', async () => {
    const root = await createArtifact('../outside.png')

    await expect(auditDeckAssets(root)).rejects.toThrow(/Unsafe image path/)
  })
})
