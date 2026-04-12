import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import PurchasingPreferencesForm from '../PurchasingPreferencesForm'
import * as buyerPreferencesQueries from '../../../lib/supabase/queries/buyerPreferences'

vi.mock('../../../lib/supabase/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('../../../lib/supabase/queries/buyerPreferences', () => ({
  getBuyerPreferences: vi.fn(),
  upsertBuyerPreferences: vi.fn(),
}))

const renderForm = () =>
  render(
    <BrowserRouter>
      <PurchasingPreferencesForm />
    </BrowserRouter>
  )

describe('PurchasingPreferencesForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(buyerPreferencesQueries.getBuyerPreferences).mockResolvedValue(null)
  })

  it('shows validation error when minimum budget exceeds maximum', async () => {
    renderForm()
    await screen.findByText(/purchasing preferences|preferenze di acquisto/i)

    fireEvent.change(screen.getByLabelText(/minimum|minimo/i), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText(/maximum|massimo/i), { target: { value: '200' } })

    expect(
      screen.getByText(/minimum budget cannot be greater than maximum budget|il budget minimo non puo essere maggiore del massimo/i)
    ).toBeInTheDocument()
  })

  it('shows validation error for non-positive values', async () => {
    renderForm()
    await screen.findByText(/purchasing preferences|preferenze di acquisto/i)

    fireEvent.change(screen.getByLabelText(/minimum|minimo/i), { target: { value: '0' } })

    expect(screen.getByText(/minimum budget must be a positive number|il budget minimo deve essere un numero positivo/i)).toBeInTheDocument()
  })

  it('enforces appellation limit of 10 tags', async () => {
    renderForm()
    await screen.findByText(/purchasing preferences|preferenze di acquisto/i)

    const input = screen.getByPlaceholderText(/e\.g\. Barolo, Brunello|es\. Barolo, Brunello/i)

    for (let index = 1; index <= 10; index += 1) {
      fireEvent.change(input, { target: { value: `Tag ${index}` } })
      fireEvent.keyDown(input, { key: 'Enter' })
    }

    fireEvent.change(input, { target: { value: 'Tag 11' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText(/you can add up to 10 appellations|puoi aggiungere fino a 10 denominazioni/i)).toBeInTheDocument()
  })

  it('pre-fills existing preferences from supabase', async () => {
    vi.mocked(buyerPreferencesQueries.getBuyerPreferences).mockResolvedValue({
      user_id: 'user-1',
      preferred_wine_types: ['Red', 'Sparkling'],
      preferred_appellations: ['Barolo'],
      monthly_budget_min: 100,
      monthly_budget_max: 400,
    })

    renderForm()

    await waitFor(() => {
      expect(screen.getByLabelText(/minimum|minimo/i)).toHaveValue(100)
      expect(screen.getByLabelText(/maximum|massimo/i)).toHaveValue(400)
      expect(screen.getByText('Barolo')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /red|rosso/i })).toBeChecked()
    })
  })
})
