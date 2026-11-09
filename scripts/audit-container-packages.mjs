import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const config = JSON.parse(await readFile(resolve(projectRoot, 'container.config.json'), 'utf8'))
const distDirectory = resolve(projectRoot, 'dist')
const outputDirectory = resolve(distDirectory, 'packages')
const enginePath = resolve(outputDirectory, `${config.engineSlug}-core.zip`)
const engineFiles = unzipSync(await readFile(enginePath))
const enginePaths = Object.keys(engineFiles)

if (!engineFiles['index.html'] || enginePaths.some((path) => path.startsWith('lang/'))) {
  throw new Error('Engine archive must contain root index.html and no lang/ directory.')
}

for (const language of config.languages) {
  const path = resolve(outputDirectory, `${config.engineSlug}-lang-${language}.zip`)
  const files = unzipSync(await readFile(path))
  const paths = Object.keys(files)
  if (
    paths.length === 0 ||
    paths.some((entry) => !entry.startsWith(`lang/${language}/`)) ||
    paths.some((entry) => entry in engineFiles)
  ) {
    throw new Error(`Container archive is empty: ${basename(path)}`)
  }
}

console.log(`Container package audit passed for ${config.languages.length + 1} archive(s).`)
