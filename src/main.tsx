import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('The application root element is missing.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App
      deckUrl={import.meta.env.DEV ? './lang/english/deck.json' : undefined}
      language={import.meta.env.DEV ? 'english' : undefined}
    />
  </StrictMode>,
)
