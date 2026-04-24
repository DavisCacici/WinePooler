import { render, screen, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '../AuthContext'

const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockSupabaseSignOut = vi.fn()
const mockUnsubscribe = vi.fn()

vi.mock('../client', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSupabaseSignOut,
    },
  },
}))

// Consumer component used in tests
const TestConsumer = () => {
  const { user, session, role, loading } = useAuth()
  if (loading) return <div>Loading...</div>
  return (
    <div>
      <span data-testid="user">{user ? user.id : 'no user'}</span>
      <span data-testid="session">{session ? 'has session' : 'no session'}</span>
      <span data-testid="role">{role ?? 'no role'}</span>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    })
  })

  it('shows loading state initially', () => {
    mockGetSession.mockReturnValue(new Promise(() => {})) // never resolves

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('provides null session when not authenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )
    })

    expect(screen.getByTestId('user')).toHaveTextContent('no user')
    expect(screen.getByTestId('session')).toHaveTextContent('no session')
    expect(screen.getByTestId('role')).toHaveTextContent('no role')
  })

  it('provides user and session when authenticated', async () => {
    const mockUser = { id: 'user-1', role: 'buyer', user_metadata: { role: 'buyer' } }
    const mockSession = { user: mockUser, access_token: 'token-abc' }
    mockGetSession.mockResolvedValue({ data: { session: mockSession } })

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )
    })

    expect(screen.getByTestId('user')).toHaveTextContent('user-1')
    expect(screen.getByTestId('session')).toHaveTextContent('has session')
    expect(screen.getByTestId('role')).toHaveTextContent('buyer')
  })

  it('subscribes to auth state changes on mount', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )
    })

    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes on unmount', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    let unmount: () => void
    await act(async () => {
      const result = render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )
      unmount = result.unmount
    })

    unmount!()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('updates session when auth state changes', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    let authCallback: (event: string, session: unknown) => void = () => {}
    mockOnAuthStateChange.mockImplementation((cb: typeof authCallback) => {
      authCallback = cb
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
    })

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )
    })

    expect(screen.getByTestId('user')).toHaveTextContent('no user')

    const newSession = { user: { id: 'user-2', role: 'winery', user_metadata: { role: 'winery' } }, access_token: 'new-token' }
    await act(async () => {
      authCallback('SIGNED_IN', newSession)
    })

    expect(screen.getByTestId('user')).toHaveTextContent('user-2')
    expect(screen.getByTestId('role')).toHaveTextContent('winery')
  })

  it('clears session on SIGNED_OUT event', async () => {
    const mockUser = { id: 'user-1', role: 'buyer', user_metadata: { role: 'buyer' } }
    const mockSession = { user: mockUser, access_token: 'token' }
    mockGetSession.mockResolvedValue({ data: { session: mockSession } })

    let authCallback: (event: string, session: unknown) => void = () => {}
    mockOnAuthStateChange.mockImplementation((cb: typeof authCallback) => {
      authCallback = cb
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
    })

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )
    })

    expect(screen.getByTestId('user')).toHaveTextContent('user-1')

    await act(async () => {
      authCallback('SIGNED_OUT', null)
    })

    expect(screen.getByTestId('user')).toHaveTextContent('no user')
    expect(screen.getByTestId('session')).toHaveTextContent('no session')
    expect(screen.getByTestId('role')).toHaveTextContent('no role')
  })

  it('throws error when useAuth is used outside AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within AuthProvider')
    consoleError.mockRestore()
  })
})
