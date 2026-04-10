import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/supabase/AuthContext'

const ROLE_ROUTES = {
  buyer: '/dashboard/buyer',
  winery: '/dashboard/winery',
} as const

const DashboardRouter = () => {
  const { loading, user, role } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-secondary bg-surface-alt">Loading dashboard...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!role) {
    return <Navigate to="/" replace />
  }

  return <Navigate to={ROLE_ROUTES[role]} replace />
}

export default DashboardRouter