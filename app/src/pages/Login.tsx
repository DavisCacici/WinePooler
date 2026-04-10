import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginUser, normalizeRole } from '../lib/supabase/auth'

const ROLE_ROUTES: Record<string, string> = {
  buyer: '/dashboard/buyer',
  winery: '/dashboard/winery',
}

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const validateForm = (): boolean => {
    if (!email.includes('@')) {
      setError('Invalid email')
      return false
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validateForm()) return

    setLoading(true)
    try {
      const data = await loginUser(email, password)
      // Prefer native Supabase role; fallback to user_metadata
      const role = normalizeRole(data.user?.role) ?? normalizeRole(data.user?.user_metadata?.role)
      const route = role ? ROLE_ROUTES[role] : '/'
      navigate(route)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-alt">
      <div className="bg-surface p-8 rounded-lg shadow-md w-full max-w-md ring-1 ring-border">
        <h2 className="text-2xl font-bold text-center mb-6 text-primary">Login</h2>
        <form onSubmit={handleSubmit}>
          {error && <p className="text-error mb-4" role="alert">{error}</p>}
          <div className="mb-4">
            <label htmlFor="email" className="block text-secondary mb-2">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="password" className="block text-secondary mb-2">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-text py-2 rounded hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className="text-center mt-4 text-secondary">
          Don't have an account? <a href="/register" className="text-primary hover:underline">Register</a>
        </p>
      </div>
    </div>
  )
}

export default Login