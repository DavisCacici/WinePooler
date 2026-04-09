interface InventoryStatusBadgeProps {
  availableStock: number | null
  allocatedBottles: number | null
  totalStock: number | null
  syncError?: boolean
}

const InventoryStatusBadge = ({
  availableStock,
  allocatedBottles,
  totalStock,
  syncError,
}: InventoryStatusBadgeProps) => {
  if (syncError) {
    return <p className="text-xs italic text-muted">Sync error — showing last known stock</p>
  }

  if (availableStock === null) return null

  if (availableStock <= 0) {
    return (
      <span className="rounded-full bg-error-bg px-2 py-0.5 text-xs font-medium text-error-text">
        Out of Stock
      </span>
    )
  }

  const isLowStock =
    totalStock != null && totalStock > 0 && allocatedBottles != null && allocatedBottles / totalStock >= 0.5

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">{availableStock} bottles available</span>
      {isLowStock && (
        <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-text">
          Low Stock
        </span>
      )}
    </div>
  )
}

export default InventoryStatusBadge
