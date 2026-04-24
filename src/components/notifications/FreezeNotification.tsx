interface FreezeNotificationProps {
  wineryName: string
  areaName: string
  onDismiss: () => void
}

const FreezeNotification = ({ wineryName, areaName, onDismiss }: FreezeNotificationProps) => (
  <div
    role="alert"
    className="flex items-start gap-4 rounded-2xl bg-[var(--color-notification-surface)] px-5 py-4 text-[var(--color-notification-text)] shadow-lg ring-1 ring-[var(--color-notification-accent)]/60"
  >
    <div className="flex-1">
      <p className="text-sm font-semibold text-[var(--color-notification-accent)]">Pallet Frozen 🧊</p>
      <p className="mt-1 text-sm opacity-80">
        Pallet for <span className="font-medium">{wineryName}</span> in{' '}
        <span className="font-medium">{areaName}</span> has been frozen!
      </p>
    </div>
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss notification"
      className="text-muted hover:text-[var(--color-notification-text)]"
    >
      ×
    </button>
  </div>
)

export default FreezeNotification
