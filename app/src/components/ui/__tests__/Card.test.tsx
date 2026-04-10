import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Card from '../Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('renders header when provided', () => {
    render(<Card header={<span>Header</span>}>Body</Card>)
    expect(screen.getByText('Header')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('renders footer when provided', () => {
    render(<Card footer={<span>Footer</span>}>Body</Card>)
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>)
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('uses semantic surface styling', () => {
    const { container } = render(<Card>Content</Card>)
    expect((container.firstChild as HTMLElement).className).toContain('bg-surface')
    expect((container.firstChild as HTMLElement).className).toContain('ring-border')
  })
})
