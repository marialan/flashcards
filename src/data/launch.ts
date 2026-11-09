import packageConfig from '../../container.config.json'

export interface ContainerLaunch {
  language: string
  deckUrl: string
}

export function resolveContainerLaunch(search: string): ContainerLaunch | null {
  const languages = new URLSearchParams(search).getAll('cr_lang')

  if (
    languages.length !== 1 ||
    !packageConfig.languages.includes(languages[0])
  ) {
    return null
  }

  const language = languages[0]
  return {
    language,
    deckUrl: `./lang/${language}/deck.json`,
  }
}
