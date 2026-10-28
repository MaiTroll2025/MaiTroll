import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HytroGamingLanding from '@/pages/gaming/HytroGamingLanding'
import MaiPayLanding from '@/pages/MaiPayLanding'
import TrollCourtLanding from '@/pages/TrollCourtLanding'
import MaiLifeLanding from '@/pages/MaiLifeLanding'

const renderPage = (Component: React.ComponentType) =>
  render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  )

describe('Public landing pages', () => {
  it('renders HytroGamingLanding', () => {
    renderPage(HytroGamingLanding)
    expect(screen.getAllByText(/HytroGaming/i).length).toBeGreaterThan(0)
  })

  it('renders MaiPayLanding', () => {
    renderPage(MaiPayLanding)
    expect(screen.getAllByText(/Mai Pay/i).length).toBeGreaterThan(0)
  })

  it('renders TrollCourtLanding', () => {
    renderPage(TrollCourtLanding)
    expect(screen.getAllByText(/Troll Court/i).length).toBeGreaterThan(0)
  })

  it('renders MaiLifeLanding', () => {
    renderPage(MaiLifeLanding)
    expect(screen.getAllByText(/Mai Life/i).length).toBeGreaterThan(0)
  })
})
