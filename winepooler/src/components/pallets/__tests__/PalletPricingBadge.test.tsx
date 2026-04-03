import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PalletPricingBadge from '../PalletPricingBadge'

describe('PalletPricingBadge', () => {
  it('renders both prices and saving badge when both prices present', () => {
    render(<PalletPricingBadge bulkPrice={8.5} retailPrice={14} />)

    expect(screen.getByText(/8,50/)).toBeInTheDocument()
    expect(screen.getByText(/14,00/)).toBeInTheDocument()
    expect(screen.getByText(/-39%/)).toBeInTheDocument()
  })

  it('renders only bulk price when retail is null', () => {
    render(<PalletPricingBadge bulkPrice={8.5} retailPrice={null} />)

    expect(screen.getByText(/8,50/)).toBeInTheDocument()
    expect(screen.queryByText(/-\d+%/)).toBeNull()
  })

  it('renders "Price TBD" when both prices are null', () => {
    render(<PalletPricingBadge bulkPrice={null} retailPrice={null} />)

    expect(screen.getByText(/price tbd/i)).toBeInTheDocument()
  })

  it('calculates saving percentage correctly: 8.50 bulk, 14.00 retail → 39%', () => {
    render(<PalletPricingBadge bulkPrice={8.5} retailPrice={14} />)

    expect(screen.getByText(/-39%/)).toBeInTheDocument()
  })

  it('does not show saving badge when bulk equals retail', () => {
    render(<PalletPricingBadge bulkPrice={10} retailPrice={10} />)

    expect(screen.queryByText(/-\d+%/)).toBeNull()
  })

  it('renders compact mode with only bulk price per bottle', () => {
    render(<PalletPricingBadge bulkPrice={8.5} retailPrice={14} compact />)

    expect(screen.getByText(/8,50.*\/bottle/)).toBeInTheDocument()
    expect(screen.queryByText(/-39%/)).toBeNull()
  })

  it('renders nothing in compact mode when bulk price is null', () => {
    const { container } = render(
      <PalletPricingBadge bulkPrice={null} retailPrice={null} compact />
    )

    expect(container.innerHTML).toBe('')
  })
})
