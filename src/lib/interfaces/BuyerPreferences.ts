export interface BuyerPreferences {
  user_id: string
  preferred_wine_types: string[]
  preferred_appellations: string[]
  monthly_budget_min: number | null
  monthly_budget_max: number | null
}