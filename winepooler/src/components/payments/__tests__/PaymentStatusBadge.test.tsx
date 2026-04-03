import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PaymentStatusBadge from '../PaymentStatusBadge'

describe('PaymentStatusBadge', () => {
  it('renders authorized state with amber styling', () => {
    render(<PaymentStatusBadge status="authorized" />)
    const badge = screen.getByText('Authorized — capture on freeze')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-amber-100')
    expect(badge.className).toContain('text-amber-800')
  })

  it('renders capture_pending state with slate styling', () => {
    render(<PaymentStatusBadge status="capture_pending" />)
    const badge = screen.getByText('Capturing')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-slate-100')
  })

  it('renders captured state with emerald styling', () => {
    render(<PaymentStatusBadge status="captured" />)
    const badge = screen.getByText('Captured')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-emerald-100')
    expect(badge.className).toContain('text-emerald-800')
  })

  it('renders capture_failed state with red styling', () => {
    render(<PaymentStatusBadge status="capture_failed" />)
    const badge = screen.getByText('Capture failed')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-red-100')
    expect(badge.className).toContain('text-red-800')
  })

  it('renders canceled state with slate styling', () => {
    render(<PaymentStatusBadge status="canceled" />)
    const badge = screen.getByText('Authorization released')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-slate-100')
  })

  it('renders expired state with red styling', () => {
    render(<PaymentStatusBadge status="expired" />)
    const badge = screen.getByText('Authorization expired')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-red-100')
    expect(badge.className).toContain('text-red-700')
  })
})
