import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/supabase/AuthContext'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button'
import { getWineryProfileByUserId, upsertWineryProfile } from '../../lib/supabase/queries/wineryProfiles'

interface WineryProfileFormProps {
  mode: 'complete' | 'edit'
}

interface FormFields {
  company_name: string
  vat_number: string
  stripe_connect_account_id?: string
}

interface FormErrors {
  company_name?: string
  vat_number?: string
  stripe_connect_account_id?: string
}

const validateForm = (fields: FormFields, t: (key: string) => string): FormErrors => {
  const errors: FormErrors = {}
  if (!fields.company_name.trim()) errors.company_name = t('wineryProfileForm.errors.companyNameRequired')
  if (!fields.vat_number.trim()) errors.vat_number = t('wineryProfileForm.errors.vatRequired')
  return errors
}

const WineryProfileForm = ({ mode }: WineryProfileFormProps) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('profile')

  const [fields, setFields] = useState<FormFields>({
    company_name: '',
    vat_number: user?.user_metadata?.vat_number ?? '',
    stripe_connect_account_id: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(mode === 'edit')

  useEffect(() => {
    if (mode === 'edit' && user) {
      getWineryProfileByUserId(user.id)
        .then(profile => {
          if (profile) {
            setFields({
              company_name: profile.company_name,
              vat_number: profile.vat_number,
              stripe_connect_account_id: profile.stripe_connect_account_id ?? '',
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

    const validationErrors = validateForm(fields, t)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      await upsertWineryProfile({
        user_id: user.id,
        company_name: fields.company_name.trim(),
        vat_number: fields.vat_number.trim(),
        stripe_connect_account_id: fields.stripe_connect_account_id?.trim(),
      })


      navigate('/dashboard/winery')
    } catch (err) {
      console.error('Error saving winery profile:', err)
      setSubmitError(err instanceof Error ? err.message : t('wineryProfileForm.errors.saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-alt">
        <p className="text-secondary">{t('wineryProfileForm.loading')}</p>
      </div>
    )
  }

  const title = mode === 'complete' ? t('wineryProfileForm.title.complete') : t('wineryProfileForm.title.edit')
  const subtitle =
    mode === 'complete'
      ? t('wineryProfileForm.subtitle.complete')
      : t('wineryProfileForm.subtitle.edit')

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl bg-surface p-8 shadow-sm ring-1 ring-border">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-buyer">
            {mode === 'complete' ? t('wineryProfileForm.badge.setup') : t('wineryProfileForm.badge.settings')}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-primary">{title}</h1>
          <p className="mt-2 text-secondary">{subtitle}</p>

          <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
            {/* Company Name */}
            <div>
              <label htmlFor="company_name" className="block text-sm font-medium text-secondary">
                {t('wineryProfileForm.fields.companyName')} <span className="text-error">*</span>
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
                {t('wineryProfileForm.fields.vatNumber')} <span className="text-error">*</span>
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

            {/* Stripe Connect Account ID */}
            <div>
              <label htmlFor="stripe_connect_account_id" className="block text-sm font-medium text-secondary">
                {t('wineryProfileForm.fields.stripeConnectAccountId')}
              </label>
              <input
                id="stripe_connect_account_id"
                name="stripe_connect_account_id"
                type="text"
                value={fields.stripe_connect_account_id}
                onChange={handleChange}
                aria-describedby={errors.stripe_connect_account_id ? 'stripe_connect_account_id-error' : undefined}
                aria-invalid={!!errors.stripe_connect_account_id}
                className={`mt-1 block w-full rounded-xl border px-4 py-2.5 text-primary focus:outline-none focus:ring-2 focus:ring-focus ${
                  errors.stripe_connect_account_id ? 'border-error bg-error-bg' : 'border-border bg-surface'
                }`}
              />
              {errors.stripe_connect_account_id && (
                <p id="stripe_connect_account_id-error" role="alert" className="mt-1 text-sm text-error">
                  {errors.stripe_connect_account_id}
                </p>
              )}
            </div>

            {submitError && (
              <p role="alert" className="rounded-xl bg-error-bg px-4 py-3 text-sm text-error">
                {submitError}
              </p>
            )}

            <div className="flex justify-end gap-3">
              {mode === 'edit' && (
                <Button
                  type="button"
                  onClick={() => navigate('/dashboard/buyer')}
                  variant='secondary'
                >
                  {t('wineryProfileForm.actions.cancel')}
                </Button>
              )}
              <Button 
                type="submit"
                disabled={submitting}
              >
                {submitting
                  ? t('wineryProfileForm.actions.saving')
                  : mode === 'complete'
                    ? t('wineryProfileForm.actions.saveAndContinue')
                    : t('wineryProfileForm.actions.saveChanges')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default WineryProfileForm

