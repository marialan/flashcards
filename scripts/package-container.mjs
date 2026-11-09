import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync, zipSync } from 'fflate'
import { auditDeckAssets } from './audit-deck-assets.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))

async function listFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const filePath = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await listFiles(filePath, root)))
    } else if (entry.isFile()) {
      files.push(relative(root, filePath).split(sep).join('/'))
    }
  }

  return files.sort()
}

function assertArchivePath(path) {
  if (
    path.startsWith('/') ||
    path.includes('\\') ||
    path.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new Error(`Archive contains an unsafe path: ${path}`)
  }
}

function validateConfig(config) {
  if (
    config.layout !== 'A' ||
    typeof config.engineSlug !== 'string' ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.engineSlug) ||
    typeof config.subAppId !== 'string' ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.subAppId) ||
    !Array.isArray(config.languages) ||
    config.languages.length === 0 ||
    config.languages.some((language) => typeof language !== 'string' || !/^[a-z0-9]+$/.test(language)) ||
    new Set(config.languages).size !== config.languages.length
  ) {
    throw new Error('Container package configuration must define an approved Layout A engine and languages.')
  }
}

async function readArchiveFiles(distDirectory, paths) {
  const files = {}

  for (const path of paths) {
    assertArchivePath(path)
    files[path] = new Uint8Array(await readFile(resolve(distDirectory, ...path.split('/'))))
  }

  return files
}

function validateArchiveLayout(engineBytes, languageBytes, language) {
  const engineFiles = unzipSync(engineBytes)
  const languageFiles = unzipSync(languageBytes)
  const enginePaths = Object.keys(engineFiles)
  const languagePaths = Object.keys(languageFiles)

  if (!enginePaths.includes('index.html') || enginePaths.some((path) => path.startsWith('lang/'))) {
    throw new Error('Engine archive must contain root index.html and no lang/ directory.')
  }

  if (languagePaths.length === 0 || languagePaths.some((path) => !path.startsWith(`lang/${language}/`))) {
    throw new Error(`Language archive must contain only lang/${language}/ files.`)
  }

  if (enginePaths.some((path) => languagePaths.includes(path))) {
    throw new Error(`Engine and ${language} archives contain overlapping paths.`)
  }
}

export async function packageContainer(
  distDirectory,
  outputDirectory,
  config,
) {
  validateConfig(config)
  await auditDeckAssets(distDirectory)

  const allFiles = await listFiles(distDirectory)
  if (allFiles.some((path) => path.endsWith('.map'))) {
    throw new Error('Source maps must not be included in container packages.')
  }

  const enginePaths = allFiles.filter((path) => !path.startsWith('lang/') && !path.startsWith('packages/'))
  if (!enginePaths.includes('index.html')) {
    throw new Error('Production output is missing root index.html.')
  }

  const engineFiles = await readArchiveFiles(distDirectory, enginePaths)
  const engineArchive = zipSync(engineFiles, { level: 0 })
  const packagePaths = []
  await mkdir(outputDirectory, { recursive: true })

  for (const language of config.languages) {
    const prefix = `lang/${language}/`
    const deckPath = `${prefix}deck.json`
    const languagePaths = allFiles.filter(
      (path) => path === deckPath || path.startsWith(`${prefix}audios/`),
    )
    if (!languagePaths.includes(deckPath) || !languagePaths.some((path) => path.startsWith(`${prefix}audios/`))) {
      throw new Error(`Language ${language} must include deck.json and pronunciation audio.`)
    }

    const deck = JSON.parse(await readFile(resolve(distDirectory, ...deckPath.split('/')), 'utf8'))
    const languagePathSet = new Set(languagePaths)
    for (const card of deck.cards) {
      if (!enginePaths.includes(card.image)) {
        throw new Error(`Image is not in the engine archive: ${card.image}`)
      }
      if (!languagePathSet.has(card.audio)) {
        throw new Error(`Audio is not in the ${language} archive: ${card.audio}`)
      }
    }

    const languageFiles = await readArchiveFiles(distDirectory, languagePaths)
    const archivePath = resolve(outputDirectory, `${config.engineSlug}-lang-${language}.zip`)
    const archive = zipSync(languageFiles, { level: 0 })
    validateArchiveLayout(engineArchive, archive, language)
    await writeFile(archivePath, archive)
    packagePaths.push(archivePath)
  }

  const engineArchivePath = resolve(outputDirectory, `${config.engineSlug}-core.zip`)
  await writeFile(engineArchivePath, engineArchive)
  packagePaths.unshift(engineArchivePath)
  return packagePaths
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(await readFile(resolve(projectRoot, 'container.config.json'), 'utf8'))
  const distDirectory = resolve(projectRoot, 'dist')
  const outputDirectory = resolve(distDirectory, 'packages')
  const archives = await packageContainer(distDirectory, outputDirectory, config)
  console.log(`Created container packages:\n${archives.map((path) => `- ${basename(path)}`).join('\n')}`)
}
