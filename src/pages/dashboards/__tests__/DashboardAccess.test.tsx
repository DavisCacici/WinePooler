import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import BuyerDashboard from '../BuyerDashboard'
import DashboardRouter from '../DashboardRouter'
import ProtectedDashboardRoute from '../ProtectedDashboardRoute'
import WineryDashboard from '../WineryDashboard'

const mockUseAuth = vi.fn()

vi.mock('../../../lib/supabase/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('Dashboard access', () => {
  it('renders buyer dashboard navigation and map view', () => {
    render(<BuyerDashboard />)

    expect(screen.getByText('Buyer Dashboard')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Buyer dashboard navigation' })).toBeInTheDocument()
    expect(screen.getByText('Map View')).toBeInTheDocument()
    expect(screen.getByText('Active Pallets')).toBeInTheDocument()
  })

  it('renders winery analytics and picking lists', () => {
    render(<WineryDashboard />)

    expect(screen.getByText('Winery Portal')).toBeInTheDocument()
    expect(screen.getByText('Analytics dashboard')).toBeInTheDocument()
    expect(screen.getByText('Picking lists')).toBeInTheDocument()
  })

  it('routes buyer users to the buyer dashboard', () => {
    mockUseAuth.mockReturnValue({ loading: false, user: { id: '1' }, role: 'buyer' })

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardRouter />} />
          <Route path="/dashboard/buyer" element={<div>Buyer route reached</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Buyer route reached')).toBeInTheDocument()
  })

  it('redirects unauthenticated users to login', () => {
    mockUseAuth.mockReturnValue({ loading: false, user: null, role: null })

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardRouter />} />
          <Route path="/login" element={<div>Login route reached</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Login route reached')).toBeInTheDocument()
  })

  it('blocks winery users from buyer-only dashboard features', () => {
    mockUseAuth.mockReturnValue({ loading: false, user: { id: '2' }, role: 'winery' })

    render(
      <MemoryRouter initialEntries={['/dashboard/buyer']}>
        <Routes>
          <Route
            path="/dashboard/buyer"
            element={
              <ProtectedDashboardRoute allowedRole="buyer">
                <BuyerDashboard />
              </ProtectedDashboardRoute>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard redirect reached</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Dashboard redirect reached')).toBeInTheDocument()
  })
})