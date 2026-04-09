import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Header from '../Header'

// Mock the AuthContext
vi.mock('../../../lib/supabase/AuthContext', () => ({
  useAuth: () => ({
    role: 'buyer',
    signOut: vi.fn(),
  }),
}))

// Mock the ThemeContext
vi.mock('../../../lib/theme/useTheme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
    setTheme: vi.fn(),
  }),
}))

describe('Header', () => {
  const renderHeader = () =>
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

  it('renders the app logo', () => {
    renderHeader()
    expect(screen.getByText('WinePooler')).toBeInTheDocument()
  })

  it('renders the role badge', () => {
    renderHeader()
    expect(screen.getByText('Buyer')).toBeInTheDocument()
  })

  it('renders theme toggle button', () => {
    renderHeader()
    expect(screen.getByLabelText(/switch to dark theme/i)).toBeInTheDocument()
  })

  it('renders profile and sign out links on desktop', () => {
    renderHeader()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
  })

  it('renders hamburger menu button for mobile', () => {
    renderHeader()
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument()
  })
})
