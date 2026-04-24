import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/supabase/AuthContext'

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

const MobileNav = ({ open, onClose }: MobileNavProps) => {
  const { role, signOut } = useAuth()
  const panelRef = useRef<HTMLDivElement>(null)

  const dashboardPath = role === 'winery' ? '/dashboard/winery' : '/dashboard/buyer'

  useEffect(() => {
    if (!open) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose()
    }
  }

  const navItems = [
    { label: 'Dashboard', to: dashboardPath },
    ...(role === 'winery'
      ? [
          { label: 'Inventory', to: '/dashboard/winery/inventory' },
        ]
      : []),
    { label: 'Profile', to: '/profile/edit' },
    ...(role === 'buyer'
      ? [
          { label: 'Area Selection', to: '/profile/area' },
          { label: 'Preferences', to: '/profile/preferences' },
        ]
      : []),
  ]

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40"
      onClick={handleBackdropClick}
      aria-hidden="true"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="absolute right-0 top-0 h-full w-72 bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <span className="text-lg font-bold text-primary">Menu</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-full p-2 text-secondary hover:bg-surface-elevated"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className="rounded-xl px-4 py-3 text-sm font-medium text-primary hover:bg-surface-alt transition-colors min-h-[44px] flex items-center"
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              onClose()
              signOut()
            }}
            className="mt-2 rounded-xl px-4 py-3 text-left text-sm font-medium text-error hover:bg-error-bg transition-colors min-h-[44px] flex items-center"
          >
            Sign Out
          </button>
        </nav>
      </div>
    </div>
  )
}

export default MobileNav
