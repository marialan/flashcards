import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { resolveContainerLaunch } from './data/launch'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('The application root element is missing.')
}

const launch = import.meta.env.DEV
  ? { deckUrl: './lang/english/deck.json', language: 'english' }
  : resolveContainerLaunch(window.location.search)

createRoot(rootElement).render(
  <StrictMode>
    <App
      deckUrl={launch?.deckUrl}
      language={launch?.language}
    />
  </StrictMode>,
)
