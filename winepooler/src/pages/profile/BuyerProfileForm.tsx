import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/supabase/AuthContext'
import { upsertBuyerProfile, getBuyerProfile } from '../../lib/supabase/queries/buyerProfile'
import { useEffect } from 'react'

interface BuyerProfileFormProps {
  mode: 'complete' | 'edit'
}

interface FormFields {
  company_name: string
  vat_number: string
  address_street: string
  address_city: string
  address_country: string
  phone: string
}

interface FormErrors {
  company_name?: string
  vat_number?: string
  address_street?: string
  address_city?: string
  address_country?: string
}

const validateForm = (fields: FormFields): FormErrors => {
  const errors: FormErrors = {}
  if (!fields.company_name.trim()) errors.company_name = 'Company name is required'
  if (!fields.vat_number.trim()) errors.vat_number = 'VAT number is required'
  if (!fields.address_street.trim()) errors.address_street = 'Street address is required'
  if (!fields.address_city.trim()) errors.address_city = 'City is required'
  if (!fields.address_country.trim()) errors.address_country = 'Country is required'
  return errors
}

const BuyerProfileForm = ({ mode }: BuyerProfileFormProps) => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [fields, setFields] = useState<FormFields>({
    company_name: '',
    vat_number: user?.user_metadata?.vat_number ?? '',
    address_street: '',
    address_city: '',
    address_country: 'IT',
    phone: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(mode === 'edit')

  useEffect(() => {
    if (mode === 'edit' && user) {
      getBuyerProfile(user.id)
        .then(profile => {
          if (profile) {
            setFields({
              company_name: profile.company_name,
              vat_number: profile.vat_number,
              address_street: profile.address_street,
              address_city: profile.address_city,
              address_country: profile.address_country,
              phone: profile.phone ?? '',
            })
          }
        })
        .finally(() => setLoading(false))
    }
  }, [mode, user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFields(prev => ({ ...prev, [name]: value }))
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const validationErrors = validateForm(fields)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      await upsertBuyerProfile({
        user_id: user.id,
        company_name: fields.company_name.trim(),
        vat_number: fields.vat_number.trim(),
        address_street: fields.address_street.trim(),
        address_city: fields.address_city.trim(),
        address_country: fields.address_country.trim(),
        phone: fields.phone.trim() || undefined,
      })

      if (mode === 'complete') {
        navigate('/profile/area')
      } else {
        navigate('/dashboard/buyer')
      }
    } catch (err) {
      console.error('Error saving buyer profile:', err)
      setSubmitError(err instanceof Error ? err.message : 'Failed to save profile. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading profile…</p>
      </div>
    )
  }

  const title = mode === 'complete' ? 'Complete Your Business Profile' : 'Edit Business Profile'
  const subtitle =
    mode === 'complete'
      ? 'Fill in your company details to start participating in pallet pooling.'
      : 'Update your company details below.'

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            {mode === 'complete' ? 'Profile Setup' : 'Profile Settings'}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-slate-600">{subtitle}</p>

          <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
            {/* Company Name */}
            <div>
              <label htmlFor="company_name" className="block text-sm font-medium text-slate-700">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                value={fields.company_name}
                onChange={handleChange}
                aria-describedby={errors.company_name ? 'company_name-error' : undefined}
                aria-invalid={!!errors.company_name}
                className={`mt-1 block w-full rounded-xl border px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.company_name ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
                }`}
              />
              {errors.company_name && (
                <p id="company_name-error" role="alert" className="mt-1 text-sm text-red-600">
                  {errors.company_name}
                </p>
              )}
            </div>

            {/* VAT Number */}
            <div>
              <label htmlFor="vat_number" className="block text-sm font-medium text-slate-700">
                VAT Number <span className="text-red-500">*</span>
              </label>
              <input
                id="vat_number"
                name="vat_number"
                type="text"
                value={fields.vat_number}
                onChange={handleChange}
                aria-describedby={errors.vat_number ? 'vat_number-error' : undefined}
                aria-invalid={!!errors.vat_number}
                className={`mt-1 block w-full rounded-xl border px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.vat_number ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
                }`}
              />
              {errors.vat_number && (
                <p id="vat_number-error" role="alert" className="mt-1 text-sm text-red-600">
                  {errors.vat_number}
                </p>
              )}
            </div>

            {/* Address Street */}
            <div>
              <label htmlFor="address_street" className="block text-sm font-medium text-slate-700">
                Street Address <span className="text-red-500">*</span>
              </label>
              <input
                id="address_street"
                name="address_street"
                type="text"
                value={fields.address_street}
                onChange={handleChange}
                aria-describedby={errors.address_street ? 'address_street-error' : undefined}
                aria-invalid={!!errors.address_street}
                className={`mt-1 block w-full rounded-xl border px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.address_street ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
                }`}
              />
              {errors.address_street && (
                <p id="address_street-error" role="alert" className="mt-1 text-sm text-red-600">
                  {errors.address_street}
                </p>
              )}
            </div>

            {/* Address City */}
            <div>
              <label htmlFor="address_city" className="block text-sm font-medium text-slate-700">
                City <span className="text-red-500">*</span>
              </label>
              <input
                id="address_city"
                name="address_city"
                type="text"
                value={fields.address_city}
                onChange={handleChange}
                aria-describedby={errors.address_city ? 'address_city-error' : undefined}
                aria-invalid={!!errors.address_city}
                className={`mt-1 block w-full rounded-xl border px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.address_city ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
                }`}
              />
              {errors.address_city && (
                <p id="address_city-error" role="alert" className="mt-1 text-sm text-red-600">
                  {errors.address_city}
                </p>
              )}
            </div>

            {/* Country */}
            <div>
              <label htmlFor="address_country" className="block text-sm font-medium text-slate-700">
                Country <span className="text-red-500">*</span>
              </label>
              <input
                id="address_country"
                name="address_country"
                type="text"
                value={fields.address_country}
                onChange={handleChange}
                aria-describedby={errors.address_country ? 'address_country-error' : undefined}
                aria-invalid={!!errors.address_country}
                className={`mt-1 block w-full rounded-xl border px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.address_country ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
                }`}
              />
              {errors.address_country && (
                <p id="address_country-error" role="alert" className="mt-1 text-sm text-red-600">
                  {errors.address_country}
                </p>
              )}
            </div>

            {/* Phone (optional) */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={fields.phone}
                onChange={handleChange}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {submitError && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </p>
            )}

            <div className="flex justify-end gap-3">
              {mode === 'edit' && (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/buyer')}
                  className="rounded-full border border-slate-200 bg-slate-50 px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : mode === 'complete' ? 'Save & Continue' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default BuyerProfileForm
