import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import Register from '../Register'
import { registerUser } from '../../lib/supabase/auth'

// Mock the auth function
vi.mock('../../lib/supabase/auth', () => ({
  registerUser: vi.fn()
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

describe('Register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders registration form', () => {
    render(
      <BrowserRouter>
        <Register />
      </BrowserRouter>
    )

    expect(screen.getByText('Register')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('VAT Number')).toBeInTheDocument()
    expect(screen.getByLabelText('Role')).toBeInTheDocument()
  })

  it('validates form fields', async () => {
    render(
      <BrowserRouter>
        <Register />
      </BrowserRouter>
    )

    const submitButton = screen.getByRole('button', { name: /register/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Invalid email')).toBeInTheDocument()
    })

    // Test password validation
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: '123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()
    })
  })

  it('submits form successfully', async () => {
    const mockRegisterUser = vi.mocked(registerUser)
    mockRegisterUser.mockResolvedValue({ user: { id: '1' } })

    render(
      <BrowserRouter>
        <Register />
      </BrowserRouter>
    )

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('VAT Number'), { target: { value: '123456' } })
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'buyer' } })

    const submitButton = screen.getByRole('button', { name: /register/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRegisterUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        vatNumber: '123456',
        role: 'buyer'
      })
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })
  })

  it('handles registration error', async () => {
    const mockRegisterUser = vi.mocked(registerUser)
    mockRegisterUser.mockRejectedValue(new Error('Registration failed'))

    render(
      <BrowserRouter>
        <Register />
      </BrowserRouter>
    )

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('VAT Number'), { target: { value: '123456' } })

    const submitButton = screen.getByRole('button', { name: /register/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Registration failed')).toBeInTheDocument()
    })
  })
})