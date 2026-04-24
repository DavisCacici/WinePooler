import type { PaymentAuthorization } from '../../lib/supabase/queries/payments'

type PaymentStatus = PaymentAuthorization['status']

interface PaymentStatusBadgeProps {
  status: PaymentStatus
}

const statusConfig: Record<PaymentStatus, { label: string; classes: string }> = {
  authorized: {
    label: 'Authorized — capture on freeze',
    classes: 'bg-warning-bg text-warning-text',
  },
  capture_pending: {
    label: 'Capturing',
    classes: 'bg-surface-elevated text-secondary',
  },
  captured: {
    label: 'Captured',
    classes: 'bg-success-bg text-success-text',
  },
  capture_failed: {
    label: 'Capture failed',
    classes: 'bg-error-bg text-error-text',
  },
  canceled: {
    label: 'Authorization released',
    classes: 'bg-surface-elevated text-secondary',
  },
  expired: {
    label: 'Authorization expired',
    classes: 'bg-error-bg text-error-text',
  },
}

const PaymentStatusBadge = ({ status }: PaymentStatusBadgeProps) => {
  const config = statusConfig[status]
  if (!config) return null

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.classes}`}
    >
      {config.label}
    </span>
  )
}

export default PaymentStatusBadge
