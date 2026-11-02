import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { resolve } from 'node:path'

test('serves the built app', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') {
      externalRequests.push(request.url())
    }
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Flashcards', level: 1 })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Content is unavailable for this launch.')
  expect(externalRequests).toEqual([])
})

test('rejects a deck redirect without requesting its destination', async ({ page }) => {
  // Serve the real loader in isolation while production content lookup remains unwired.
  for (const name of ['loadDeck', 'deck']) {
    const source = await readFile(resolve('src', 'data', `${name}.ts`), 'utf8')
    await page.route(`**/__test__/${name}`, (route) =>
      route.fulfill({ contentType: 'text/javascript', body: stripTypeScriptTypes(source) }),
    )
  }

  const destination = 'http://127.0.0.1:4174/redirected-deck.json'
  const destinationRequests: string[] = []
  page.on('request', (request) => {
    if (request.url() === destination) destinationRequests.push(request.url())
  })
  await page.route(destination, (route) => route.fulfill({ status: 500 }))
  let redirectRequests = 0
  await page.route('**/redirect-deck.json', (route) => {
    redirectRequests += 1
    return route.fulfill({ status: 302, headers: { location: destination } })
  })

  await page.goto('/')
  const outcome = await page.evaluate(async () => {
    const moduleUrl = '/__test__/loadDeck'
    const { loadDeck } = await import(moduleUrl)
    try {
      await loadDeck('./redirect-deck.json', 'english', {
        signal: new AbortController().signal,
      })
      return 'unexpected success'
    } catch (error) {
      return error instanceof Error && 'category' in error ? error.category : 'unexpected error'
    }
  })

  expect(outcome).toBe('request')
  expect(redirectRequests).toBe(1)
  expect(destinationRequests).toEqual([])
})
