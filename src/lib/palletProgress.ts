export const palletProgressPercent = (bottleCount: number, threshold: number): number =>
  threshold > 0 ? Math.min(Math.round((bottleCount / threshold) * 100), 100) : 0

export const palletProgressLabel = (bottleCount: number, threshold: number): string =>
  `${palletProgressPercent(bottleCount, threshold)}%`

/**
 * Returns a unit-aware progress label.
 * When displayUnit is 'case' and bottlesPerDisplayUnit is known, shows e.g. "42/60 cases of 6".
 * Otherwise falls back to "bottleCount/threshold bottles".
 */
export const palletProgressUnitLabel = (
  bottleCount: number,
  threshold: number,
  displayUnit: string | null,
  displayUnitLabel: string | null,
  bottlesPerDisplayUnit: number | null
): string => {
  if (displayUnit === 'case' && bottlesPerDisplayUnit && bottlesPerDisplayUnit > 0) {
    const currentUnits = Math.floor(bottleCount / bottlesPerDisplayUnit)
    const totalUnits = Math.floor(threshold / bottlesPerDisplayUnit)
    const label = displayUnitLabel ?? 'cases'
    return `${currentUnits}/${totalUnits} ${label}`
  }
  return `${bottleCount}/${threshold} bottles`
}
