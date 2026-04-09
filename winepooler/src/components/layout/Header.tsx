import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/supabase/AuthContext'
import ThemeToggle from '../ui/ThemeToggle'
import MobileNav from './MobileNav'

const Header = () => {
  const { role, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const roleBadge = role === 'winery'
    ? { label: 'Winery', className: 'bg-accent-winery-bg text-accent-winery-text' }
    : { label: 'Buyer', className: 'bg-accent-buyer-bg text-accent-buyer-text' }

  const dashboardPath = role === 'winery' ? '/dashboard/winery' : '/dashboard/buyer'

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          {/* Logo */}
          <Link to={dashboardPath} className="text-lg font-bold text-primary">
            WinePooler
          </Link>

          {/* Role badge */}
          <span className={`hidden sm:inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadge.className}`}>
            {roleBadge.label}
          </span>

          <div className="flex-1" />

          {/* Desktop actions */}
          <nav className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <Link
              to="/profile/edit"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-secondary hover:bg-surface-elevated transition-colors"
            >
              Profile
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-secondary hover:bg-surface-elevated transition-colors"
            >
              Sign Out
            </button>
          </nav>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="rounded-full p-2 text-secondary hover:bg-surface-elevated"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}

export default Header
