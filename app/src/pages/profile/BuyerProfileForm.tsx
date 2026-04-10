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
      <div className="flex min-h-screen items-center justify-center bg-surface-alt">
        <p className="text-secondary">Loading profile…</p>
      </div>
    )
  }

  const title = mode === 'complete' ? 'Complete Your Business Profile' : 'Edit Business Profile'
  const subtitle =
    mode === 'complete'
      ? 'Fill in your company details to start participating in pallet pooling.'
      : 'Update your company details below.'

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-buyer">
            {mode === 'complete' ? 'Profile Setup' : 'Profile Settings'}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-primary">{title}</h1>
          <p className="mt-2 text-secondary">{subtitle}</p>

          <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
            {/* Company Name */}
            <div>
              <label htmlFor="company_name" className="block text-sm font-medium text-secondary">
                Company Name <span className="text-error">*</span>
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                value={fields.company_name}
                onChange={handleChange}
                aria-describedby={errors.company_name ? 'company_name-error' : undefined}
                aria-invalid={!!errors.company_name}
                className={`mt-1 block w-full rounded-xl border px-4 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-focus ${
                  errors.company_name ? 'border-error bg-error-bg' : 'border-border bg-surface'
                }`}
              />
              {errors.company_name && (
                <p id="company_name-error" role="alert" className="mt-1 text-sm text-error">
                  {errors.company_name}
                </p>
              )}
            </div>

            {/* VAT Number */}
            <div>
              <label htmlFor="vat_number" className="block text-sm font-medium text-secondary">
                VAT Number <span className="text-error">*</span>
              </label>
              <input
                id="vat_number"
                name="vat_number"
                type="text"
                value={fields.vat_number}
                onChange={handleChange}
                aria-describedby={errors.vat_number ? 'vat_number-error' : undefined}
                aria-invalid={!!errors.vat_number}
                className={`mt-1 block w-full rounded-xl border px-4 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-focus ${
                  errors.vat_number ? 'border-error bg-error-bg' : 'border-border bg-surface'
                }`}
              />
              {errors.vat_number && (
                <p id="vat_number-error" role="alert" className="mt-1 text-sm text-error">
                  {errors.vat_number}
                </p>
              )}
            </div>

            {/* Address Street */}
            <div>
              <label htmlFor="address_street" className="block text-sm font-medium text-secondary">
                Street Address <span className="text-error">*</span>
              </label>
              <input
                id="address_street"
                name="address_street"
                type="text"
                value={fields.address_street}
                onChange={handleChange}
                aria-describedby={errors.address_street ? 'address_street-error' : undefined}
                aria-invalid={!!errors.address_street}
                className={`mt-1 block w-full rounded-xl border px-4 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-focus ${
                  errors.address_street ? 'border-error bg-error-bg' : 'border-border bg-surface'
                }`}
              />
              {errors.address_street && (
                <p id="address_street-error" role="alert" className="mt-1 text-sm text-error">
                  {errors.address_street}
                </p>
              )}
            </div>

            {/* Address City */}
            <div>
              <label htmlFor="address_city" className="block text-sm font-medium text-secondary">
                City <span className="text-error">*</span>
              </label>
              <input
                id="address_city"
                name="address_city"
                type="text"
                value={fields.address_city}
                onChange={handleChange}
                aria-describedby={errors.address_city ? 'address_city-error' : undefined}
                aria-invalid={!!errors.address_city}
                className={`mt-1 block w-full rounded-xl border px-4 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-focus ${
                  errors.address_city ? 'border-error bg-error-bg' : 'border-border bg-surface'
                }`}
              />
              {errors.address_city && (
                <p id="address_city-error" role="alert" className="mt-1 text-sm text-error">
                  {errors.address_city}
                </p>
              )}
            </div>

            {/* Country */}
            <div>
              <label htmlFor="address_country" className="block text-sm font-medium text-secondary">
                Country <span className="text-error">*</span>
              </label>
              <input
                id="address_country"
                name="address_country"
                type="text"
                value={fields.address_country}
                onChange={handleChange}
                aria-describedby={errors.address_country ? 'address_country-error' : undefined}
                aria-invalid={!!errors.address_country}
                className={`mt-1 block w-full rounded-xl border px-4 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-focus ${
                  errors.address_country ? 'border-error bg-error-bg' : 'border-border bg-surface'
                }`}
              />
              {errors.address_country && (
                <p id="address_country-error" role="alert" className="mt-1 text-sm text-error">
                  {errors.address_country}
                </p>
              )}
            </div>

            {/* Phone (optional) */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-secondary">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={fields.phone}
                onChange={handleChange}
                className="mt-1 block w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-focus"
              />
            </div>

            {submitError && (
              <p role="alert" className="rounded-xl bg-error-bg px-4 py-3 text-sm text-error">
                {submitError}
              </p>
            )}

            <div className="flex justify-end gap-3">
              {mode === 'edit' && (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/buyer')}
                  className="rounded-full border border-border bg-surface-alt px-6 py-2.5 text-sm font-medium text-secondary hover:bg-surface-elevated"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-accent-buyer px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
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
