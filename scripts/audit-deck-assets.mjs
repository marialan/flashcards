import { access, readdir, readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

const imageSignatures = {
  png: (bytes) =>
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
  jpg: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  jpeg: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  webp: (bytes) =>
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP',
  svg: (bytes) =>
    /^\uFEFF?\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(
      bytes.toString('utf8'),
    ),
}

const audioSignatures = {
  mp3: (bytes) =>
    bytes.length >= 3 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)),
  wav: (bytes) =>
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WAVE',
}

async function findJsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const jsonFiles = []

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      jsonFiles.push(...(await findJsonFiles(entryPath)))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      jsonFiles.push(entryPath)
    }
  }

  return jsonFiles
}

function isDeckCandidate(value, filePath) {
  return (
    filePath.split(sep).at(-1).toLowerCase() === 'deck.json' ||
    (typeof value === 'object' &&
      value !== null &&
      ('schema_version' in value || 'cards' in value || 'card_order' in value))
  )
}

function decodeAssetPath(value, deckPath, cardId, mediaType) {
  let decodedPath = value

  for (let attempt = 0; attempt < 10; attempt += 1) {
    let nextPath

    try {
      nextPath = decodeURIComponent(decodedPath)
    } catch {
      throw new Error(`Invalid URI encoding in ${mediaType} path for "${cardId}" in ${deckPath}.`)
    }

    if (nextPath === decodedPath) {
      break
    }

    decodedPath = nextPath

    if (attempt === 9) {
      throw new Error(`Excessively encoded ${mediaType} path for "${cardId}" in ${deckPath}.`)
    }
  }

  if (
    /^[a-z][a-z\d+.-]*:/i.test(decodedPath) ||
    decodedPath.startsWith('/') ||
    decodedPath.includes('\\') ||
    decodedPath.includes('?') ||
    decodedPath.includes('#') ||
    decodedPath.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`Unsafe ${mediaType} path for "${cardId}" in ${deckPath}: ${value}`)
  }

  return decodedPath
}

async function auditMediaReference({
  assetRoot,
  deckPath,
  cardId,
  mediaType,
  value,
  language,
}) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing ${mediaType} path for "${cardId}" in ${deckPath}.`)
  }

  const assetPathValue = decodeAssetPath(value, deckPath, cardId, mediaType)
  const segments = assetPathValue.split('/')

  if (
    mediaType === 'audio' &&
    !assetPathValue.startsWith(`lang/${language}/audios/`)
  ) {
    throw new Error(`Audio path for "${cardId}" must be inside lang/${language}/audios/.`)
  }

  const extension = assetPathValue.slice(assetPathValue.lastIndexOf('.') + 1).toLowerCase()
  const signatures = mediaType === 'image' ? imageSignatures : audioSignatures
  const signatureMatches = signatures[extension]

  if (!signatureMatches) {
    throw new Error(`Unsupported ${mediaType} format for "${cardId}" in ${deckPath}: ${value}`)
  }

  const assetPath = resolve(assetRoot, ...segments)
  const assetRelativePath = relative(assetRoot, assetPath)

  if (
    isAbsolute(assetRelativePath) ||
    assetRelativePath === '..' ||
    assetRelativePath.startsWith(`..${sep}`)
  ) {
    throw new Error(`${mediaType} path escapes the installed game directory: ${value}`)
  }

  try {
    await access(assetPath)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Missing ${mediaType} asset for "${cardId}": ${value}`)
    }

    throw error
  }

  const bytes = await readFile(assetPath)

  if (!signatureMatches(bytes)) {
    throw new Error(`${mediaType} asset bytes do not match the declared format: ${value}`)
  }
}

export async function auditDeckAssets(assetRoot) {
  const jsonFiles = await findJsonFiles(assetRoot)
  let deckCount = 0

  for (const jsonPath of jsonFiles) {
    let data

    try {
      data = JSON.parse(await readFile(jsonPath, 'utf8'))
    } catch (error) {
      throw new Error(`Invalid JSON artifact at ${jsonPath}: ${error.message}`)
    }

    if (!isDeckCandidate(data, jsonPath)) {
      continue
    }

    if (
      typeof data !== 'object' ||
      data === null ||
      data.schema_version !== 1 ||
      typeof data.language !== 'string' ||
      !Array.isArray(data.cards)
    ) {
      throw new Error(`Invalid deck structure at ${jsonPath}.`)
    }

    deckCount += 1

    for (const card of data.cards) {
      if (typeof card !== 'object' || card === null || typeof card.card_id !== 'string') {
        throw new Error(`Invalid card entry in deck ${jsonPath}.`)
      }

      await auditMediaReference({
        assetRoot,
        deckPath: jsonPath,
        cardId: card.card_id,
        mediaType: 'image',
        value: card.image,
        language: data.language,
      })
      await auditMediaReference({
        assetRoot,
        deckPath: jsonPath,
        cardId: card.card_id,
        mediaType: 'audio',
        value: card.audio,
        language: data.language,
      })
    }
  }

  if (deckCount === 0) {
    throw new Error('No packaged card decks were found.')
  }

  return deckCount
}
