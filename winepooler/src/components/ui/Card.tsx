import type { ReactNode } from 'react'

interface CardProps {
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}

const Card = ({ header, footer, children, className = '' }: CardProps) => {
  return (
    <div className={`rounded-3xl bg-surface shadow-sm ring-1 ring-border ${className}`}>
      {header && (
        <div className="border-b border-border px-6 py-4">{header}</div>
      )}
      <div className="p-6">{children}</div>
      {footer && (
        <div className="border-t border-border px-6 py-4">{footer}</div>
      )}
    </div>
  )
}

export default Card
