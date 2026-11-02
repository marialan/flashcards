import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the flashcards app shell', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Flashcards', level: 1 })).toBeVisible()
  })
})
