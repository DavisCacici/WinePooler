import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import FreezeNotification from '../FreezeNotification'

describe('FreezeNotification', () => {
  const defaultProps = {
    wineryName: 'Cantina Aurora',
    areaName: 'North Milan',
    onDismiss: vi.fn(),
  }

  it('renders winery name, area name, and frozen label', () => {
    render(<FreezeNotification {...defaultProps} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/pallet frozen/i)).toBeInTheDocument()
    expect(screen.getByText(/cantina aurora/i)).toBeInTheDocument()
    expect(screen.getByText(/north milan/i)).toBeInTheDocument()
  })

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    render(<FreezeNotification {...defaultProps} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('renders full notification message with winery and area', () => {
    render(<FreezeNotification wineryName="Vigna Nuova" areaName="Lake Garda" onDismiss={vi.fn()} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Vigna Nuova')
    expect(alert).toHaveTextContent('Lake Garda')
    expect(alert).toHaveTextContent('has been frozen')
  })
})
