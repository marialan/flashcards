import { afterEach, describe, expect, it, vi } from 'vitest'

const { renderRoot } = vi.hoisted(() => ({ renderRoot: vi.fn() }))

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({ render: renderRoot })),
}))

describe('launch entrypoint', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    vi.resetModules()
    document.getElementById('root')?.remove()
  })

  it.each([
    {
      mode: 'development',
      development: true,
      expectedProps: { deckUrl: './lang/english/deck.json', language: 'english' },
    },
    {
      mode: 'production',
      development: false,
      expectedProps: { deckUrl: undefined, language: undefined },
    },
  ])('uses the correct launch context in $mode', async ({ development, expectedProps }) => {
    vi.stubEnv('DEV', development)
    const root = document.createElement('div')
    root.id = 'root'
    document.body.append(root)

    await import('./main')

    expect(renderRoot).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        props: expect.objectContaining({
          children: expect.objectContaining({ props: expectedProps }),
        }),
      }),
    )
  })
})
