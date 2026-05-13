export interface SellingUnit {
  // Identificatore univoco dell'unita di vendita.
  id: string
  // Cantina a cui appartiene questa configurazione.
  winery_id: string
  // Tipo di unita: singola bottiglia, cassa o pallet intero.
  unit_type: 'bottle' | 'case' | 'pallet'
  // Numero di bottiglie per cassa (es. 6, 12). Null se unit_type != case.
  bottles_per_case: number | null
  // Come e composto il pallet: da bottiglie singole o da casse. Null se unit_type != pallet.
  composition_type: 'bottles' | 'cases' | null
  // Quante unita (bottiglie o casse) compongono il pallet; usato per calcolare il threshold.
  pallet_quantity: number | null
  // Sconto percentuale applicato rispetto al prezzo retail per questa unita.
  discount_pct: number
  // Timestamp di creazione.
  created_at: string
  // Timestamp dell'ultimo aggiornamento.
  updated_at: string
}

export interface PalletThresholdInfo {
  // Soglia in bottiglie calcolata (es. pallet_quantity x bottles_per_case).
  threshold: number
  // Unita da mostrare in UI (bottle o case).
  displayUnit: string
  // Etichetta leggibile dell'unita (es. "casse da 6").
  displayUnitLabel: string
  // Fattore di conversione unita -> bottiglie; usato per il calcolo del progresso.
  bottlesPerDisplayUnit: number | null
}

export interface ProductSellingUnit {
  // Id del legame prodotto/unita di vendita.
  id: string
  // Prodotto in inventario associato.
  inventory_id: string
  // Unita di vendita associata.
  selling_unit_id: string
  // Se questa unita e attiva per il prodotto.
  enabled: boolean
  // Timestamp di creazione.
  created_at: string
}

export interface UnitPrice {
  // Tipo unita (bottle, case, pallet).
  unitType: string
  // Etichetta leggibile (es. "cassa da 6").
  unitLabel: string
  // Prezzo bulk totale per questa unita (gia scontato).
  bulkPrice: number
  // Prezzo retail totale equivalente, per confronto con il bulk. Null se non disponibile.
  retailPrice: number | null
  // Percentuale di risparmio rispetto al retail. Null se retail non disponibile.
  savingPct: number | null
  // Quante bottiglie equivale questa unita (per confronti omogenei).
  bottleEquivalent: number
  // Sconto applicato (dalla SellingUnit di riferimento).
  discountPct: number
}