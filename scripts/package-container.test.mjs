import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import test from 'node:test'
import { unzipSync } from 'fflate'
import { packageContainer } from './package-container.mjs'

test('creates clean Layout A engine and language archives', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'flashcards-package-'))
  const distDirectory = resolve(root, 'dist')
  const outputDirectory = resolve(root, 'packages')

  try {
    await mkdir(resolve(distDirectory, 'assets', 'images'), { recursive: true })
    await mkdir(resolve(distDirectory, 'lang', 'english', 'audios'), { recursive: true })
    await writeFile(resolve(distDirectory, 'index.html'), '<div id="root"></div>')
    await writeFile(resolve(distDirectory, 'assets', 'images', 'one.png'), Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]))
    await writeFile(resolve(distDirectory, 'lang', 'english', 'audios', 'one.mp3'), 'ID3')
    await writeFile(
      resolve(distDirectory, 'lang', 'english', 'deck.json'),
      JSON.stringify({
        schema_version: 1,
        language: 'english',
        cards: [{
          card_id: 'one',
          target_word: 'one',
          image: 'assets/images/one.png',
          audio: 'lang/english/audios/one.mp3',
        }],
        card_order: ['one'],
      }),
    )

    const archives = await packageContainer(distDirectory, outputDirectory, {
      layout: 'A',
      engineSlug: 'flashcard',
      subAppId: 'flashcard',
      languages: ['english'],
    })
    const engine = unzipSync(await readFile(archives[0]))
    const language = unzipSync(await readFile(archives[1]))

    assert.deepEqual(archives.map((path) => path.split(/[\\/]/).at(-1)), [
      'flashcard-core.zip',
      'flashcard-lang-english.zip',
    ])
    assert.ok(engine['index.html'])
    assert.ok(engine['assets/images/one.png'])
    assert.equal(Object.keys(engine).some((path) => path.startsWith('lang/')), false)
    assert.deepEqual(Object.keys(language).sort(), [
      'lang/english/audios/one.mp3',
      'lang/english/deck.json',
    ])
    assert.equal(Object.keys(engine).some((path) => path in language), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects a package with a missing referenced media file', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'flashcards-package-invalid-'))
  const distDirectory = resolve(root, 'dist')

  try {
    await mkdir(resolve(distDirectory, 'assets'), { recursive: true })
    await mkdir(resolve(distDirectory, 'lang', 'english', 'audios'), { recursive: true })
    await writeFile(resolve(distDirectory, 'index.html'), '<div id="root"></div>')
    await writeFile(resolve(distDirectory, 'lang', 'english', 'audios', 'one.mp3'), 'ID3')
    await writeFile(
      resolve(distDirectory, 'lang', 'english', 'deck.json'),
      JSON.stringify({
        schema_version: 1,
        language: 'english',
        cards: [{
          card_id: 'one',
          target_word: 'one',
          image: 'assets/images/missing.png',
          audio: 'lang/english/audios/one.mp3',
        }],
        card_order: ['one'],
      }),
    )

    await assert.rejects(
      packageContainer(distDirectory, resolve(root, 'packages'), {
        layout: 'A',
        engineSlug: 'flashcard',
        subAppId: 'flashcard',
        languages: ['english'],
      }),
      /Missing image asset/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
