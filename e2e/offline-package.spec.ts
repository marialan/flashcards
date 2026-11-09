import { expect, test } from '@playwright/test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { unzipSync } from 'fflate'

async function extractArchive(archivePath: string, destination: string) {
  const entries = unzipSync(await readFile(archivePath))

  for (const [path, content] of Object.entries(entries)) {
    const filePath = resolve(destination, ...path.split('/'))
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content)
  }
}

test('extracted packages run from file: without external requests', async ({ browser }) => {
  const root = await mkdtemp(resolve(tmpdir(), 'flashcards-offline-'))
  const extractedGame = resolve(root, 'nested', 'game')
  const packages = resolve(process.cwd(), 'dist', 'packages')
  const externalRequests: string[] = []

  try {
    await extractArchive(resolve(packages, 'flashcard-core.zip'), extractedGame)
    await extractArchive(resolve(packages, 'flashcard-lang-english.zip'), extractedGame)

    const context = await browser.newContext()
    await context.route(/^https?:/, async (route) => {
      externalRequests.push(route.request().url())
      await route.abort()
    })
    const page = await context.newPage()
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(
      `${pathToFileURL(resolve(extractedGame, 'index.html')).href}?cr_lang=english&cr_user_id=offline-test-user`,
    )

    await expect(page.getByRole('status')).toContainText('3 cards ready.')
    await expect.poll(() =>
      page.locator('.card-image').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    ).toBe(true)
    await page.getByRole('button', { name: 'Show word' }).click()
    await expect(page.getByText('sat')).toBeVisible()
    await expect.poll(() =>
      page.evaluate(() => localStorage.getItem('flashcards:progress:v1:english:offline-test-user')),
    ).not.toBeNull()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Show picture' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(externalRequests).toEqual([])
    expect(pageErrors).toEqual([])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
