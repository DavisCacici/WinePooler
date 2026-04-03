import type { PaymentAuthorization } from '../../lib/supabase/queries/payments'

type PaymentStatus = PaymentAuthorization['status']

interface PaymentStatusBadgeProps {
  status: PaymentStatus
}

const statusConfig: Record<PaymentStatus, { label: string; classes: string }> = {
  authorized: {
    label: 'Authorized — capture on freeze',
    classes: 'bg-amber-100 text-amber-800',
  },
  capture_pending: {
    label: 'Capturing',
    classes: 'bg-slate-100 text-slate-700',
  },
  captured: {
    label: 'Captured',
    classes: 'bg-emerald-100 text-emerald-800',
  },
  capture_failed: {
    label: 'Capture failed',
    classes: 'bg-red-100 text-red-800',
  },
  canceled: {
    label: 'Authorization released',
    classes: 'bg-slate-100 text-slate-600',
  },
  expired: {
    label: 'Authorization expired',
    classes: 'bg-red-100 text-red-700',
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
