import { expect, test } from '@playwright/test'

test('serves the built app', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') {
      externalRequests.push(request.url())
    }
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Flashcards', level: 1 })).toBeVisible()
  expect(externalRequests).toEqual([])
})
