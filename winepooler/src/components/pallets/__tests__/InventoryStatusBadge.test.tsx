import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import InventoryStatusBadge from '../InventoryStatusBadge'

describe('InventoryStatusBadge', () => {
  it('renders "Out of Stock" red badge when availableStock is 0', () => {
    render(
      <InventoryStatusBadge
        availableStock={0}
        allocatedBottles={800}
        totalStock={800}
      />
    )

    expect(screen.getByText(/out of stock/i)).toBeInTheDocument()
  })

  it('renders "Out of Stock" when availableStock is negative', () => {
    render(
      <InventoryStatusBadge
        availableStock={-10}
        allocatedBottles={810}
        totalStock={800}
      />
    )

    expect(screen.getByText(/out of stock/i)).toBeInTheDocument()
  })

  it('renders "Low Stock" amber badge when allocated >= 50% of total', () => {
    render(
      <InventoryStatusBadge
        availableStock={300}
        allocatedBottles={500}
        totalStock={800}
      />
    )

    expect(screen.getByText(/300 bottles available/i)).toBeInTheDocument()
    expect(screen.getByText(/low stock/i)).toBeInTheDocument()
  })

  it('renders available stock without Low Stock badge when allocation < 50%', () => {
    render(
      <InventoryStatusBadge
        availableStock={600}
        allocatedBottles={200}
        totalStock={800}
      />
    )

    expect(screen.getByText(/600 bottles available/i)).toBeInTheDocument()
    expect(screen.queryByText(/low stock/i)).toBeNull()
  })

  it('shows sync error message when syncError is true', () => {
    render(
      <InventoryStatusBadge
        availableStock={300}
        allocatedBottles={500}
        totalStock={800}
        syncError
      />
    )

    expect(screen.getByText(/sync error/i)).toBeInTheDocument()
    expect(screen.queryByText(/300 bottles available/i)).toBeNull()
  })

  it('renders nothing when availableStock is null', () => {
    const { container } = render(
      <InventoryStatusBadge
        availableStock={null}
        allocatedBottles={null}
        totalStock={null}
      />
    )

    expect(container.innerHTML).toBe('')
  })
})
