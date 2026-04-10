import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LayoutShell from '../LayoutShell'

vi.mock('../../../lib/supabase/AuthContext', () => ({
  useAuth: () => ({
    role: 'buyer',
    signOut: vi.fn(),
  }),
}))

vi.mock('../../../lib/theme/useTheme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
    setTheme: vi.fn(),
  }),
}))

describe('LayoutShell', () => {
  it('renders Header and children', () => {
    render(
      <MemoryRouter>
        <LayoutShell>
          <div>Page Content</div>
        </LayoutShell>
      </MemoryRouter>
    )

    expect(screen.getByText('WinePooler')).toBeInTheDocument()
    expect(screen.getByText('Page Content')).toBeInTheDocument()
  })

  it('wraps content in main element', () => {
    render(
      <MemoryRouter>
        <LayoutShell>
          <div>Content</div>
        </LayoutShell>
      </MemoryRouter>
    )

    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})
