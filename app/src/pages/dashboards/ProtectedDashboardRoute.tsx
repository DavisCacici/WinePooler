import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/supabase/AuthContext'
import type { AppRole } from '../../lib/supabase/auth'

type ProtectedDashboardRouteProps = {
  allowedRole?: AppRole | AppRole[]
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

  if (allowedRole) {
    const roles = Array.isArray(allowedRole) ? allowedRole : [allowedRole]

    if (!role || !roles.includes(role)) {
      return <Navigate to="/dashboard" replace />
    }
  }

  if (!role) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export default ProtectedDashboardRoute