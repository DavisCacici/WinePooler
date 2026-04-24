import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerUser, type RegisterData } from '../lib/supabase/auth'

const Register = () => {
  const [formData, setFormData] = useState<RegisterData>({
    email: '',
    password: '',
    vatNumber: '',
    role: 'buyer',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const validateForm = () => {
    if (!formData.email.includes('@')) {
      setError('Invalid email')
      return false
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return false
    }
    if (!formData.vatNumber) {
      setError('VAT number is required')
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
      await registerUser(formData)
      // Success - Supabase sends confirmation email
      navigate('/login')
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-alt">
      <div className="bg-surface p-8 rounded-lg shadow-md w-full max-w-md ring-1 ring-border">
        <h2 className="text-2xl font-bold text-center mb-6 text-primary">Register</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-secondary mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-border rounded bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-focus"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-secondary mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-border rounded bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-focus"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-secondary mb-2">VAT Number</label>
            <input
              type="text"
              name="vatNumber"
              value={formData.vatNumber}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-border rounded bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-focus"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-secondary mb-2">Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-border rounded bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <option value="buyer">Buyer</option>
              <option value="winery">Winery</option>
            </select>
          </div>
          {error && <p className="text-error mb-4">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-text py-2 rounded border border-border hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p className="text-center mt-4 text-secondary">
          Already have an account? <a href="/login" className="text-primary hover:underline">Login</a>
        </p>
      </div>
    </div>
  )
}

export default Register