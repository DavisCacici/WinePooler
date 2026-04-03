interface FreezeNotificationProps {
  wineryName: string
  areaName: string
  onDismiss: () => void
}

const FreezeNotification = ({ wineryName, areaName, onDismiss }: FreezeNotificationProps) => (
  <div
    role="alert"
    className="flex items-start gap-4 rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg ring-1 ring-amber-400/60"
  >
    <div className="flex-1">
      <p className="text-sm font-semibold text-amber-300">Pallet Frozen 🧊</p>
      <p className="mt-1 text-sm text-slate-200">
        Pallet for <span className="font-medium">{wineryName}</span> in{' '}
        <span className="font-medium">{areaName}</span> has been frozen!
      </p>
    </div>
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss notification"
      className="text-slate-400 hover:text-white"
    >
      ×
    </button>
  </div>
)

export default FreezeNotification
