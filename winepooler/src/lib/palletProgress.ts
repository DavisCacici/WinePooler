export const palletProgressPercent = (bottleCount: number, threshold: number): number =>
  threshold > 0 ? Math.min(Math.round((bottleCount / threshold) * 100), 100) : 0

export const palletProgressLabel = (bottleCount: number, threshold: number): string =>
  `${palletProgressPercent(bottleCount, threshold)}%`
