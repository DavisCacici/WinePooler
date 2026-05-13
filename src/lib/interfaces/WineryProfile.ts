export interface WineryProfile {
  id?: string
  user_id: string
  company_name: string
  vat_number: string
  stripe_connect_account_id?: string | null
}