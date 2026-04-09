import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MobileNav from '../MobileNav'

vi.mock('../../../lib/supabase/AuthContext', () => ({
  useAuth: () => ({
    role: 'buyer',
    signOut: vi.fn(),
  }),
}))

describe('MobileNav', () => {
  it('renders nothing when closed', () => {
    render(
      <MemoryRouter>
        <MobileNav open={false} onClose={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders navigation items when open', () => {
    render(
      <MemoryRouter>
        <MobileNav open={true} onClose={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
  })

  it('shows buyer-specific items for buyer role', () => {
    render(
      <MemoryRouter>
        <MobileNav open={true} onClose={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.getByText('Area Selection')).toBeInTheDocument()
    expect(screen.getByText('Preferences')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <MobileNav open={true} onClose={onClose} />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByLabelText('Close menu'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <MobileNav open={true} onClose={onClose} />
      </MemoryRouter>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
