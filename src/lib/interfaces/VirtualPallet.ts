export interface VirtualPallet {
  // Identificatore univoco del pallet virtuale.
  id: string
  // Area geografica (macro area) in cui il pallet e visibile.
  area_id: string
  // Profilo cantina proprietario del pallet.
  winery_id: string
  // Stato del ciclo di vita: aperto, congelato (non ordinabile), completato.
  state: 'open' | 'frozen' | 'completed'
  // Bottiglie attualmente prenotate sul pallet.
  bottle_count: number
  // Capienza obiettivo del pallet in bottiglie.
  threshold: number
  // Utente che ha creato il pallet.
  created_by: string
  // Prezzo riservato agli ordini all'ingrosso (EUR/bottiglia).
  price_per_bottle: number | null
  // Inventario vino associato, se presente.
  inventory_id: string | null
  // Disponibilita residua in inventario (total_stock - allocated_bottles), se calcolabile.
  available_stock: number | null
  // Bottiglie gia allocate sull'inventario associato, se disponibili.
  allocated_bottles: number | null
  // Nome area denormalizzato per UI/listati.
  area_name?: string
  // Nome cantina denormalizzato per UI/listati.
  winery_name?: string
}

export interface PickingListRow {
  // Id del pallet nella lista di picking della cantina.
  id: string
  // Stato corrente del pallet (open, frozen, completed).
  state: string
  // Bottiglie totali ordinate sul pallet.
  bottle_count: number
  // Soglia target del pallet in bottiglie.
  threshold: number
  // Nome della macro area.
  area_name: string
  // Nome vino associato all'inventario, se disponibile.
  wine_label: string | null
  // Giacenza gia allocata, se disponibile.
  allocated_bottles: number | null
  // Stato payout (es. processing, paid, failed), se esiste.
  payout_status: string | null
  // Netto liquidato in centesimi, se presente.
  payout_net_cents: number | null
  // Commissione in centesimi, se presente.
  payout_commission_cents: number | null
}