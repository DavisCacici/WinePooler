import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import BuyerProfileForm from '../BuyerProfileForm'
import * as buyerProfileQueries from '../../../lib/supabase/queries/buyerProfile'

// Mock the auth context
const mockUser = { id: 'user-1', user_metadata: { vat_number: 'IT12345678901' } }
vi.mock('../../../lib/supabase/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock queries
vi.mock('../../../lib/supabase/queries/buyerProfile', () => ({
  upsertBuyerProfile: vi.fn(),
  getBuyerProfile: vi.fn(),
}))

const fillValidForm = () => {
  fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Acme SRL' } })
  fireEvent.change(screen.getByLabelText(/vat number/i), { target: { value: 'IT12345678901' } })
  fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: 'Via Roma 1' } })
  fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Milan' } })
  // Country has a default value of 'IT' so it's already filled
}

const renderForm = (mode: 'complete' | 'edit' = 'complete') =>
  render(
    <BrowserRouter>
      <BuyerProfileForm mode={mode} />
    </BrowserRouter>
  )

describe('BuyerProfileForm - complete mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all required form fields', () => {
    renderForm('complete')
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/vat number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/street address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
  })

  it('pre-fills VAT number from user metadata', () => {
    renderForm('complete')
    expect(screen.getByLabelText(/vat number/i)).toHaveValue('IT12345678901')
  })

  it('shows "Complete Your Business Profile" heading in complete mode', () => {
    renderForm('complete')
    expect(screen.getByText(/complete your business profile/i)).toBeInTheDocument()
  })

  describe('validation', () => {
    it('shows errors for all empty required fields on submit', async () => {
      renderForm('complete')
      // Clear the pre-filled VAT
      fireEvent.change(screen.getByLabelText(/vat number/i), { target: { value: '' } })
      // Clear country default
      fireEvent.change(screen.getByLabelText(/country/i), { target: { value: '' } })

      fireEvent.click(screen.getByRole('button', { name: /save & continue/i }))

      await waitFor(() => {
        expect(screen.getByText(/company name is required/i)).toBeInTheDocument()
        expect(screen.getByText(/vat number is required/i)).toBeInTheDocument()
        expect(screen.getByText(/street address is required/i)).toBeInTheDocument()
        expect(screen.getByText(/city is required/i)).toBeInTheDocument()
        expect(screen.getByText(/country is required/i)).toBeInTheDocument()
      })
    })

    it('does not submit the form when required fields are missing', async () => {
      renderForm('complete')
      fireEvent.change(screen.getByLabelText(/vat number/i), { target: { value: '' } })

      fireEvent.click(screen.getByRole('button', { name: /save & continue/i }))

      await waitFor(() => {
        expect(buyerProfileQueries.upsertBuyerProfile).not.toHaveBeenCalled()
      })
    })

    it('clears a field error when the user types in it', async () => {
      renderForm('complete')
      fireEvent.click(screen.getByRole('button', { name: /save & continue/i }))

      await waitFor(() => {
        expect(screen.getByText(/company name is required/i)).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Acme SRL' } })

      await waitFor(() => {
        expect(screen.queryByText(/company name is required/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('submission', () => {
    it('calls upsertBuyerProfile with correct data and navigates to /profile/area on success', async () => {
      vi.mocked(buyerProfileQueries.upsertBuyerProfile).mockResolvedValue({
        id: 'profile-1',
        user_id: 'user-1',
        company_name: 'Acme SRL',
        vat_number: 'IT12345678901',
        address_street: 'Via Roma 1',
        address_city: 'Milan',
        address_country: 'IT',
      })

      renderForm('complete')
      fillValidForm()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save & continue/i }))
      })

      await waitFor(() => {
        expect(buyerProfileQueries.upsertBuyerProfile).toHaveBeenCalledWith({
          user_id: 'user-1',
          company_name: 'Acme SRL',
          vat_number: 'IT12345678901',
          address_street: 'Via Roma 1',
          address_city: 'Milan',
          address_country: 'IT',
          phone: undefined,
        })
        expect(mockNavigate).toHaveBeenCalledWith('/profile/area')
      })
    })

    it('shows submit error when upsertBuyerProfile throws', async () => {
      vi.mocked(buyerProfileQueries.upsertBuyerProfile).mockRejectedValue(
        new Error('Network error')
      )

      renderForm('complete')
      fillValidForm()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save & continue/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network error')
      })
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})

describe('BuyerProfileForm - edit mode', () => {
  const existingProfile = {
    id: 'profile-1',
    user_id: 'user-1',
    company_name: 'Existing SRL',
    vat_number: 'IT99999999999',
    address_street: 'Via Verdi 5',
    address_city: 'Rome',
    address_country: 'IT',
    phone: '+39 06 555 1234',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(buyerProfileQueries.getBuyerProfile).mockResolvedValue(existingProfile)
  })

  it('shows "Edit Business Profile" heading in edit mode', async () => {
    renderForm('edit')
    await waitFor(() => {
      expect(screen.getByText(/edit business profile/i)).toBeInTheDocument()
    })
  })

  it('pre-populates fields from existing profile', async () => {
    renderForm('edit')
    await waitFor(() => {
      expect(screen.getByLabelText(/company name/i)).toHaveValue('Existing SRL')
      expect(screen.getByLabelText(/vat number/i)).toHaveValue('IT99999999999')
      expect(screen.getByLabelText(/street address/i)).toHaveValue('Via Verdi 5')
      expect(screen.getByLabelText(/city/i)).toHaveValue('Rome')
      expect(screen.getByLabelText(/phone/i)).toHaveValue('+39 06 555 1234')
    })
  })

  it('navigates to /dashboard/buyer after successful save in edit mode', async () => {
    vi.mocked(buyerProfileQueries.upsertBuyerProfile).mockResolvedValue(existingProfile)

    renderForm('edit')
    await waitFor(() => {
      expect(screen.getByLabelText(/company name/i)).toHaveValue('Existing SRL')
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/buyer')
    })
  })

  it('navigates to /dashboard/buyer when Cancel is clicked', async () => {
    renderForm('edit')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/buyer')
  })
})
