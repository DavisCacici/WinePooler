import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PaymentStatusBadge from '../PaymentStatusBadge'

describe('PaymentStatusBadge', () => {
  it('renders authorized state with warning styling', () => {
    render(<PaymentStatusBadge status="authorized" />)
    const badge = screen.getByText('Authorized — capture on freeze')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-warning-bg')
    expect(badge.className).toContain('text-warning-text')
  })

  it('renders capture_pending state with elevated styling', () => {
    render(<PaymentStatusBadge status="capture_pending" />)
    const badge = screen.getByText('Capturing')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-surface-elevated')
  })

  it('renders captured state with success styling', () => {
    render(<PaymentStatusBadge status="captured" />)
    const badge = screen.getByText('Captured')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-success-bg')
    expect(badge.className).toContain('text-success-text')
  })

  it('renders capture_failed state with error styling', () => {
    render(<PaymentStatusBadge status="capture_failed" />)
    const badge = screen.getByText('Capture failed')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-error-bg')
    expect(badge.className).toContain('text-error-text')
  })

  it('renders canceled state with elevated styling', () => {
    render(<PaymentStatusBadge status="canceled" />)
    const badge = screen.getByText('Authorization released')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-surface-elevated')
  })

  it('renders expired state with error styling', () => {
    render(<PaymentStatusBadge status="expired" />)
    const badge = screen.getByText('Authorization expired')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-error-bg')
    expect(badge.className).toContain('text-error-text')
  })
})
