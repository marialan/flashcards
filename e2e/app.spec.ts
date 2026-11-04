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
    const flipper = document.createElement('div')
    flipper.className = 'card-flipper'
    flipper.dataset.face = 'image'
    for (const [width, height] of [[100, 200], [200, 100]]) {
      const image = document.createElement('img')
      image.className = 'card-image'
      image.alt = 'Picture card'
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#31584e"/></svg>`
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      const face = document.createElement('div')
      face.className = 'card-face card-image-face'
      face.append(image)
      flipper.append(face)
    }
    const wordFace = document.createElement('div')
    wordFace.className = 'card-face card-word'
    wordFace.setAttribute('aria-hidden', 'true')
    wordFace.textContent = `Café ${'extraordinarilylongword'.repeat(12)}`
    flipper.append(wordFace)
    card.append(flipper)
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
      const hiddenWordAriaHidden = wordFace.getAttribute('aria-hidden')
      wordFace.setAttribute('aria-hidden', 'false')
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
      const imageLayouts = Array.from(images, (image) => {
        const imageRect = image.getBoundingClientRect()
        const face = image.closest<HTMLElement>('.card-face')
        if (!face) throw new Error('The image face is unavailable.')
        const faceRect = face.getBoundingClientRect()
        const faceLeft = faceRect.left + face.clientLeft
        const faceTop = faceRect.top + face.clientTop
        const faceRight = faceLeft + face.clientWidth
        const faceBottom = faceTop + face.clientHeight
        return {
          naturalAspectRatio: image.naturalWidth / image.naturalHeight,
          objectFit: getComputedStyle(image).objectFit,
          bounds: {
            imageLeft: imageRect.left,
            imageTop: imageRect.top,
            imageRight: imageRect.right,
            imageBottom: imageRect.bottom,
            faceLeft,
            faceTop,
            faceRight,
            faceBottom,
          },
          imageMatchesFace:
            Math.abs(imageRect.left - faceLeft) <= 1 &&
            Math.abs(imageRect.top - faceTop) <= 1 &&
            Math.abs(imageRect.right - faceRight) <= 1 &&
            Math.abs(imageRect.bottom - faceBottom) <= 1,
        }
      })
      wordFace.setAttribute('aria-hidden', 'true')
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        images: Array.from(images, (image) => ({
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          objectFit: getComputedStyle(image).objectFit,
        })),
        imageLayouts,
        mainTop: mainRect.top,
        mainBottom: mainRect.bottom,
        cardLeft: cardRect.left,
        cardRight: cardRect.right,
        cardTop: cardRect.top,
        cardBottom: cardRect.bottom,
        cardCenterX: cardRect.left + cardRect.width / 2,
        hiddenWordAriaHidden,
        wordLayout,
      }
    })

    expect(layout.documentWidth).toBeLessThanOrEqual(viewport.width)
    expect(layout.images).toEqual([
      { naturalWidth: 100, naturalHeight: 200, objectFit: 'contain' },
      { naturalWidth: 200, naturalHeight: 100, objectFit: 'contain' },
    ])
    for (const image of layout.imageLayouts) {
      expect(image.objectFit).toBe('contain')
      expect(image.imageMatchesFace, JSON.stringify(image.bounds)).toBe(true)
      expect(image.naturalAspectRatio).toBeGreaterThan(0)
    }
    expect(layout.mainTop).toBeGreaterThanOrEqual(0)
    expect(layout.mainBottom).toBeLessThanOrEqual(viewport.height)
    expect(layout.cardLeft).toBeGreaterThanOrEqual(0)
    expect(layout.cardRight).toBeLessThanOrEqual(viewport.width)
    expect(layout.cardTop).toBeGreaterThanOrEqual(0)
    expect(layout.cardBottom).toBeLessThanOrEqual(viewport.height)
    expect(layout.cardCenterX).toBeCloseTo(viewport.width / 2, 0)
    expect(layout.hiddenWordAriaHidden).toBe('true')
    expect(layout.wordLayout.text).toBe(`Café ${'extraordinarilylongword'.repeat(12)}`)
    expect(layout.wordLayout.fontSize).toBeGreaterThanOrEqual(32)
    expect(layout.wordLayout.overflowWrap).toBe('anywhere')
    expect(layout.wordLayout.overflowY).toBe('auto')
    expect(layout.wordLayout.width).toBeCloseTo(layout.wordLayout.clientWidth + 6, 0)
    expect(
      Math.abs(layout.wordLayout.height - layout.wordLayout.clientHeight - 6),
    ).toBeLessThan(1)
    expect(layout.wordLayout.scrollWidth).toBeLessThanOrEqual(layout.wordLayout.clientWidth)
    expect(layout.wordLayout.scrollHeight).toBeGreaterThan(layout.wordLayout.clientHeight)
  }
})

test('rotates the bordered card surface together with its content', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) throw new Error('The activity shell is unavailable.')

    const card = document.createElement('button')
    card.className = 'card-box'
    card.setAttribute('aria-label', 'Show word')
    const flipper = document.createElement('div')
    flipper.className = 'card-flipper'
    flipper.dataset.face = 'image'
    const imageFace = document.createElement('div')
    imageFace.className = 'card-face card-image-face'
    const image = document.createElement('img')
    image.className = 'card-image'
    image.src = './lang/english/images/cat.png'
    image.alt = 'Picture card'
    imageFace.append(image)
    const wordFace = document.createElement('div')
    wordFace.className = 'card-face card-word'
    wordFace.textContent = 'cat'
    flipper.append(imageFace, wordFace)
    card.append(flipper)
    card.addEventListener('click', () => {
      flipper.dataset.face = flipper.dataset.face === 'image' ? 'word' : 'image'
    })
    main.replaceChildren(card)
  })

  const card = page.getByRole('button', { name: 'Show word' })
  for (const face of ['word', 'image']) {
    await card.click()
    const rotation = await card.evaluate((element) => {
      const flipper = element.querySelector<HTMLElement>('.card-flipper')
      if (!flipper) throw new Error('The card flipper is unavailable.')
      const transition = flipper.getAnimations()[0]
      if (!transition) throw new Error('The card flip did not start.')
      transition.pause()
      transition.currentTime = 70

      const shell = getComputedStyle(element)
      const shellWidth = element.getBoundingClientRect().width
      const surfaces = Array.from(flipper.querySelectorAll('.card-face'), (surface) => {
        const style = getComputedStyle(surface)
        return {
          width: surface.getBoundingClientRect().width,
          borderWidth: style.borderTopWidth,
          background: style.backgroundColor,
          shadow: style.boxShadow,
          backfaceVisibility: style.backfaceVisibility,
        }
      })
      return {
        shellWidth,
        shellBorder: shell.borderTopWidth,
        shellBackground: shell.backgroundColor,
        shellOverflow: shell.overflow,
        transformStyle: getComputedStyle(flipper).transformStyle,
        surfaces,
      }
    })

    expect(rotation.shellBorder).toBe('0px')
    expect(rotation.shellBackground).toBe('rgba(0, 0, 0, 0)')
    expect(rotation.shellOverflow).toBe('visible')
    expect(rotation.transformStyle).toBe('preserve-3d')
    for (const surface of rotation.surfaces) {
      expect(surface.borderWidth).toBe('3px')
      expect(surface.background).toBe('rgb(255, 254, 250)')
      expect(surface.shadow).not.toBe('none')
      expect(surface.backfaceVisibility).toBe('hidden')
      expect(surface.width).toBeLessThan(rotation.shellWidth * 0.9)
      expect(surface.width).toBeGreaterThan(rotation.shellWidth * 0.2)
    }

    await card.evaluate((element) => {
      const flipper = element.querySelector('.card-flipper')
      if (!flipper) throw new Error('The card flipper is unavailable.')
      for (const animation of flipper.getAnimations()) animation.finish()
    })
    await expect(card.locator('.card-flipper')).toHaveAttribute('data-face', face)
  }
})

test('animates flips and slides for 200 ms and removes motion when requested', async ({ page }) => {
  await page.goto('/')
  const timing = await page.evaluate(async () => {
    const card = document.createElement('button')
    card.className = 'card-box'
    const flipper = document.createElement('div')
    flipper.className = 'card-flipper'
    flipper.dataset.face = 'image'
    const word = document.createElement('div')
    word.className = 'card-face card-word'
    word.setAttribute('aria-hidden', 'true')
    word.textContent = 'sat'
    flipper.append(word)
    card.append(flipper)
    document.querySelector('main')?.append(card)
    if (!card.isConnected) throw new Error('The test card is unavailable.')

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const flipDuration = getComputedStyle(flipper).transitionDuration
    const flipStart = performance.now()
    const flipEnd = new Promise<number>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error('The card flip transition did not finish.')),
        1000,
      )
      flipper.addEventListener('transitionend', (event) => {
        if (event.propertyName !== 'transform') return
        window.clearTimeout(timeout)
        resolve(performance.now() - flipStart)
      }, { once: true })
    })
    flipper.dataset.face = 'word'
    word.setAttribute('aria-hidden', 'false')
    const flipElapsed = await flipEnd
    const revealedWord = {
      visibility: getComputedStyle(word).visibility,
      backfaceVisibility: getComputedStyle(word).backfaceVisibility,
      ariaHidden: word.getAttribute('aria-hidden'),
    }

    const returnStart = performance.now()
    const returnEnd = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error('The reverse card flip transition did not finish.')),
        1000,
      )
      flipper.addEventListener('transitionend', (event) => {
        if (event.propertyName !== 'transform') return
        window.clearTimeout(timeout)
        resolve()
      }, { once: true })
    })
    flipper.dataset.face = 'image'
    word.setAttribute('aria-hidden', 'true')
    await returnEnd
    const returnElapsed = performance.now() - returnStart

    const slideStart = performance.now()
    const slideEnd = new Promise<number>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error('The card slide animation did not finish.')),
        1000,
      )
      card.addEventListener('animationend', () => {
        window.clearTimeout(timeout)
        resolve(performance.now() - slideStart)
      }, { once: true })
    })
    card.dataset.transition = 'next'
    const slideDuration = getComputedStyle(card).animationDuration
    const slideElapsed = await slideEnd

    return {
      flipDuration,
      flipElapsed,
      revealedWord,
      returnElapsed,
      slideDuration,
      slideElapsed,
    }
  })

  expect(timing.flipDuration).toBe('0.2s')
  expect(timing.flipElapsed).toBeGreaterThanOrEqual(150)
  expect(timing.flipElapsed).toBeLessThan(400)
  expect(timing.revealedWord).toEqual({
    visibility: 'visible',
    backfaceVisibility: 'hidden',
    ariaHidden: 'false',
  })
  expect(timing.returnElapsed).toBeGreaterThanOrEqual(150)
  expect(timing.returnElapsed).toBeLessThan(400)
  expect(timing.slideDuration).toBe('0.2s')
  expect(timing.slideElapsed).toBeGreaterThanOrEqual(150)
  expect(timing.slideElapsed).toBeLessThan(400)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reducedMotion = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.card-box')
    const flipper = card?.querySelector<HTMLElement>('.card-flipper')
    const word = card?.querySelector<HTMLElement>('.card-word')
    if (!card || !flipper || !word) throw new Error('The test card is unavailable.')
    flipper.dataset.face = 'word'
    word.setAttribute('aria-hidden', 'false')
    return {
      transitionDuration: getComputedStyle(flipper).transitionDuration,
      animationName: getComputedStyle(card).animationName,
      transform: getComputedStyle(flipper).transform,
      wordVisibility: getComputedStyle(word).visibility,
    }
  })
  expect(reducedMotion).toEqual({
    transitionDuration: '0s',
    animationName: 'none',
    transform: 'none',
    wordVisibility: 'visible',
  })
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
