export interface WineInventory {
  id: string
  winery_id: string
  wine_label: string
  sku: string
  description: string | null
  image_url: string | null
  allocated_bottles: number
  price: number | null
  allocated_case: number
  available: boolean
  updated_at?: string | null
}

export interface WineryInventoryRow extends WineInventory {
  winery_name: string
}

export interface UpsertWineInventoryInput {
  winery_id: string
  wine_label: string
  sku: string
  description?: string | null
  image_url?: string | null
  price?: number | null
  allocated_case?: number
  allocated_bottles?: number
  available?: boolean
}