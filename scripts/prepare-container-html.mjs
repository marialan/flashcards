import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const htmlPath = fileURLToPath(new URL('../dist/index.html', import.meta.url))
const html = await readFile(htmlPath, 'utf8')
const moduleScripts = [...html.matchAll(/<script\b[^>]*type="module"[^>]*><\/script>/g)]

if (moduleScripts.length !== 1) {
  throw new Error(`Expected one bundled app script; found ${moduleScripts.length}.`)
}

const scriptTag = moduleScripts[0][0]
const scriptSource = scriptTag.match(/\bsrc="([^"]+)"/)?.[1]

if (!scriptSource?.startsWith('./')) {
  throw new Error(`The standalone app script must use a relative path: ${scriptSource ?? 'missing'}.`)
}

const standaloneScript = `<script defer src="${scriptSource}"></script>`
const standaloneHtml = html
  .replace(scriptTag, standaloneScript)
  .replace(/\s+crossorigin(?:="[^"]*")?/g, '')

await writeFile(htmlPath, standaloneHtml)
