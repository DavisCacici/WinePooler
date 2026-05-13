export interface BuyerProfile {
  id?: string
  user_id: string
  company_name: string
  vat_number: string
  address_street: string
  address_city: string
  address_country: string
  phone?: string
  macro_area_id?: string | null
  macro_area_name?: string | null
}
