import { access, readdir, readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const distDirectory = fileURLToPath(new URL('../dist/', import.meta.url))
const html = await readFile(resolve(distDirectory, 'index.html'), 'utf8')
const assetReferences = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(
  ([, reference]) => reference,
)

if (assetReferences.length === 0) {
  throw new Error('The production HTML has no local asset references.')
}

for (const reference of assetReferences) {
  if (!reference.startsWith('./') || reference.includes('\\')) {
    throw new Error(`Asset reference is not relative: ${reference}`)
  }

  const assetPath = resolve(distDirectory, reference)
  const relativeAssetPath = relative(distDirectory, assetPath)

  if (
    isAbsolute(relativeAssetPath) ||
    relativeAssetPath === '..' ||
    relativeAssetPath.startsWith(`..${sep}`)
  ) {
    throw new Error(`Asset reference escapes the production directory: ${reference}`)
  }

  await access(assetPath)
}

async function findSourceMaps(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const sourceMaps = []

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      sourceMaps.push(...(await findSourceMaps(entryPath)))
    } else if (entry.name.endsWith('.map')) {
      sourceMaps.push(entryPath)
    }
  }

  return sourceMaps
}

const sourceMaps = await findSourceMaps(distDirectory)

if (sourceMaps.length > 0) {
  throw new Error(`Source maps must not be shipped: ${sourceMaps.join(', ')}`)
}

console.log(`Artifact audit passed for ${assetReferences.length} relative assets; no source maps found.`)
