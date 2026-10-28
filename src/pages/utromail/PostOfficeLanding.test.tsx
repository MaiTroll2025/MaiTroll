import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PostOfficeLanding from '@/pages/utromail/PostOfficeLanding'

describe('PostOfficeLanding (public page)', () => {
  it('renders without crashing and shows the landing title', () => {
    render(
      <MemoryRouter>
        <PostOfficeLanding />
      </MemoryRouter>,
    )
    expect(screen.getAllByText(/MaiTroll Post Office/i).length).toBeGreaterThan(0)
  })

  it('has sign-in / create-account links', () => {
    render(
      <MemoryRouter>
        <PostOfficeLanding />
      </MemoryRouter>,
    )
    expect(screen.getAllByText(/Sign in/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Create account/i).length).toBeGreaterThan(0)
  })
})
