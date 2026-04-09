import type { ReactNode } from 'react'
import Header from './Header'

interface LayoutShellProps {
  children: ReactNode
}

const LayoutShell = ({ children }: LayoutShellProps) => {
  return (
    <div className="min-h-screen bg-surface-alt">
      <Header />
      <main>{children}</main>
    </div>
  )
}

export default LayoutShell
