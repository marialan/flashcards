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

  await page.keyboard.press('Tab')
  const retryButton = page.getByRole('button', { name: 'Retry' })
  await expect(retryButton).toBeFocused()
  await expect
    .poll(() =>
      retryButton.evaluate((button) => {
        const style = getComputedStyle(button)
        return [style.outlineStyle, style.outlineWidth]
      }),
    )
    .toEqual(['solid', '3px'])
})

test('fits the card shell at the specified viewport sizes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('alert')).toBeVisible()
  await page.evaluate(() => {
    const main = document.querySelector('main')
    const heading = main?.querySelector('h1')
    if (!main || !heading) throw new Error('The activity shell is unavailable.')

    const card = document.createElement('div')
    card.className = 'card-box'
    for (const [width, height] of [[100, 200], [200, 100]]) {
      const image = document.createElement('img')
      image.className = 'card-image'
      image.alt = 'Picture card'
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#31584e"/></svg>`
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      card.append(image)
    }
    const wordFace = document.createElement('div')
    wordFace.className = 'card-word'
    wordFace.hidden = true
    wordFace.textContent = `Café ${'extraordinarilylongword'.repeat(12)}`
    card.append(wordFace)
    const status = document.createElement('p')
    status.className = 'load-status'
    status.textContent = '3 cards ready.'
    main.replaceChildren(heading, card, status)
  })

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 568, height: 320 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport)
    const layout = await page.evaluate(() => {
      const main = document.querySelector('main')
      const card = document.querySelector('.card-box')
      const images = document.querySelectorAll<HTMLImageElement>('.card-image')
      const wordFace = document.querySelector<HTMLElement>('.card-word')
      if (!main || !card || images.length !== 2 || !wordFace) {
        throw new Error('The card shell is unavailable.')
      }

      const mainRect = main.getBoundingClientRect()
      const cardRect = card.getBoundingClientRect()
      const hiddenWordDisplay = getComputedStyle(wordFace).display
      wordFace.hidden = false
      const wordStyle = getComputedStyle(wordFace)
      const wordRect = wordFace.getBoundingClientRect()
      const wordLayout = {
        text: wordFace.textContent,
        fontSize: Number.parseFloat(wordStyle.fontSize),
        overflowWrap: wordStyle.overflowWrap,
        overflowY: wordStyle.overflowY,
        width: wordRect.width,
        height: wordRect.height,
        scrollWidth: wordFace.scrollWidth,
        clientWidth: wordFace.clientWidth,
        scrollHeight: wordFace.scrollHeight,
        clientHeight: wordFace.clientHeight,
      }
      wordFace.hidden = true
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        images: Array.from(images, (image) => ({
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          objectFit: getComputedStyle(image).objectFit,
        })),
        mainTop: mainRect.top,
        mainBottom: mainRect.bottom,
        cardLeft: cardRect.left,
        cardRight: cardRect.right,
        cardTop: cardRect.top,
        cardBottom: cardRect.bottom,
        cardCenterX: cardRect.left + cardRect.width / 2,
        hiddenWordDisplay,
        wordLayout,
      }
    })

    expect(layout.documentWidth).toBeLessThanOrEqual(viewport.width)
    expect(layout.images).toEqual([
      { naturalWidth: 100, naturalHeight: 200, objectFit: 'contain' },
      { naturalWidth: 200, naturalHeight: 100, objectFit: 'contain' },
    ])
    expect(layout.mainTop).toBeGreaterThanOrEqual(0)
    expect(layout.mainBottom).toBeLessThanOrEqual(viewport.height)
    expect(layout.cardLeft).toBeGreaterThanOrEqual(0)
    expect(layout.cardRight).toBeLessThanOrEqual(viewport.width)
    expect(layout.cardTop).toBeGreaterThanOrEqual(0)
    expect(layout.cardBottom).toBeLessThanOrEqual(viewport.height)
    expect(layout.cardCenterX).toBeCloseTo(viewport.width / 2, 0)
    expect(layout.hiddenWordDisplay).toBe('none')
    expect(layout.wordLayout.text).toBe(`Café ${'extraordinarilylongword'.repeat(12)}`)
    expect(layout.wordLayout.fontSize).toBeGreaterThanOrEqual(32)
    expect(layout.wordLayout.overflowWrap).toBe('anywhere')
    expect(layout.wordLayout.overflowY).toBe('auto')
    expect(layout.wordLayout.width).toBe(layout.wordLayout.clientWidth)
    expect(
      Math.abs(layout.wordLayout.height - layout.wordLayout.clientHeight),
    ).toBeLessThan(1)
    expect(layout.wordLayout.scrollWidth).toBeLessThanOrEqual(layout.wordLayout.clientWidth)
    expect(layout.wordLayout.scrollHeight).toBeGreaterThan(layout.wordLayout.clientHeight)
  }
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

test('restores progress after reload and isolates it by launch identity', async ({ page }) => {
  const source = await readFile(resolve('src', 'progress', 'progress.ts'), 'utf8')
  await page.route('**/__test__/progress', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: stripTypeScriptTypes(source) }),
  )

  await page.goto('/?cr_book=reader&cr_lang=english&cr_user_id=user-one')
  const saved = await page.evaluate(async () => {
    const { createProgressStorageKey, saveProgress } = await import('/__test__/progress')
    const key = createProgressStorageKey(window.location.search, 'english')
    saveProgress(key, 'mat', 'word')
    return key
  })
  expect(saved).toBe('flashcards:progress:v1:reader:english:user-one')

  await page.reload()
  const restored = await page.evaluate(async () => {
    const { createProgressStorageKey, readSavedProgress } = await import('/__test__/progress')
    const key = createProgressStorageKey(window.location.search, 'english')
    return key ? readSavedProgress(key) : null
  })
  expect(restored).toEqual({ schema_version: 1, card_id: 'mat', face: 'word' })

  await page.goto('/?cr_book=reader&cr_lang=english&cr_user_id=user-two')
  const otherUserProgress = await page.evaluate(async () => {
    const { createProgressStorageKey, readSavedProgress } = await import('/__test__/progress')
    const key = createProgressStorageKey(window.location.search, 'english')
    return key ? readSavedProgress(key) : null
  })
  expect(otherUserProgress).toBeNull()
})
