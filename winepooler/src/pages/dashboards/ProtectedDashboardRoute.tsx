import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/supabase/AuthContext'
import type { AppRole } from '../../lib/supabase/auth'

type ProtectedDashboardRouteProps = {
  allowedRole: AppRole
  children: ReactNode
}

const ProtectedDashboardRoute = ({ allowedRole, children }: ProtectedDashboardRouteProps) => {
  const { loading, user, role } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-secondary bg-surface-alt">Loading dashboard...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role !== allowedRole) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export default ProtectedDashboardRoute