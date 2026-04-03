# Story 3.3: Automatic Pallet Freezing

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the system,
I want to automatically freeze a pallet when the threshold is reached,
so that orders are committed for fulfillment.

## Acceptance Criteria

1. Given a pallet has `bottle_count` equal to or exceeding `threshold` (600)
   When the `increment_pallet_bottle_count` RPC completes (Story 3.2)
   Then the pallet's `state` is automatically changed to `frozen`
   And `updated_at` is refreshed

2. Given a pallet transitions to `frozen`
   When any buyer in the same Macro-Area is viewing the dashboard
   Then the pallet card updates in real-time (via the existing Realtime subscription from Story 3.2)
   And the card shows a `FROZEN` state badge
   And the "Add Order" button is absent/disabled

3. Given a pallet has just been frozen
   When any buyer who has an order on that pallet is signed in
   Then they receive an in-app notification: "Pallet for [Winery] in [Area] has been frozen!"
   And the notification persists until dismissed

4. Given a pallet is in `frozen` state
   When any buyer tries to add a new order to it (e.g., via direct API call)
   Then the operation is rejected at the DB level
   And an error message is returned

5. Given a pallet's `bottle_count` is incremented to exactly `threshold`
   When the system checks freeze eligibility
   Then the pallet is frozen (boundary condition: `bottle_count >= threshold`)

## Tasks / Subtasks

- [x] Extend `increment_pallet_bottle_count` RPC to auto-freeze (AC: 1, 4, 5)
  - [x] After incrementing `bottle_count`, check if the new count >= `threshold`
  - [x] If yes, set `state = 'frozen'` in the same UPDATE statement
  - [x] Return both `new_count` and `new_state` from the function (update return type to a composite or use OUT params)
  - [x] The `WHERE state = 'open'` guard already in the RPC prevents double-freeze (AC: 4)
- [x] Update `addOrderToPallet` in `virtualPallets.ts` to handle the new RPC return shape (AC: 1)
  - [x] Destructure both `new_count` and `new_state` from the RPC response
  - [x] Return `{ newCount: number, newState: 'open' | 'frozen' }` from `addOrderToPallet`
- [x] Update `AddOrderModal` to handle freeze result (AC: 1, 2)
  - [x] Pass `newState` alongside `newCount` through the `onOrderAdded` callback
  - [x] `onOrderAdded` signature: `(newCount: number, newState: 'open' | 'frozen') => void`
- [x] Update `BuyerDashboard.tsx` `handleOrderAdded` to apply new state (AC: 1, 2)
  - [x] Apply both `bottles: newCount` and `state: newState` when updating the specific pallet card
  - [x] Realtime subscription (Story 3.2) will also broadcast the state change to all other buyers
- [x] Implement in-app notification for pallet freeze (AC: 3)
  - [x] Create `src/components/notifications/FreezeNotification.tsx` — a dismissible banner/toast
  - [x] In `BuyerDashboard.tsx`, when a pallet Realtime UPDATE event arrives with `state = 'frozen'`:
    - [x] Check if the current buyer has an order on that pallet via `getMyOrdersForPallet(palletId, userId)`
    - [x] If yes, push a notification entry to a `notifications` state array
  - [x] Add `getMyOrdersForPallet(palletId, buyerId)` to `virtualPallets.ts` — queries `pallet_orders` for matching `pallet_id + buyer_id`
  - [x] Render notifications as a fixed-position stack at top-right of screen
  - [x] Each notification has an × dismiss button that removes it from state
- [x] Write unit tests (AC: 1, 3, 4, 5)
  - [x] Test RPC logic: `bottle_count + quantity >= threshold` → state becomes `frozen`
  - [x] Test boundary: `bottle_count = 599`, `quantity = 1` → frozen; `quantity` keeping count < 600 → open
  - [x] Test `addOrderToPallet` returns correct `newState` from mock RPC
  - [x] Test `handleOrderAdded` updates pallet state locally to `frozen` when `newState = 'frozen'`
  - [x] Test freeze notification: Realtime event with `state = 'frozen'` + buyer has matching order → notification shown; no matching order → no notification

## Dev Notes

### Architecture & Technical Context

- **Stack**: React.js + TypeScript, Tailwind CSS, Supabase (PostgreSQL + Realtime), Vercel
- **RPC ownership**: `increment_pallet_bottle_count` was created in Story 3.2. This story **modifies** it — do not create a new function, use `CREATE OR REPLACE FUNCTION`
- **Atomic freeze**: the freeze must happen inside the same `UPDATE` that increments the count, not as a separate call. This ensures no race window between the increment and the state change (NFR1 / Story 3.4)
- **Realtime propagation**: the Realtime subscription on `virtual_pallets` UPDATE events is already wired in `BuyerDashboard.tsx` (Story 3.2). The Realtime payload will carry the new `state = 'frozen'` automatically — no additional subscription is needed
- **Notification scope**: in-app only (no email/push in this epic). A simple React state array of notification objects rendered as a toast stack. No external notification library needed
- **`getMyOrdersForPallet` query**: queries `pallet_orders` filtering by `pallet_id` AND `buyer_id = auth.uid()`. Returns `true/false` or the order rows. Use `.maybeSingle()` or `.limit(1)` for efficiency
- **Styling conventions**: `text-emerald-700` accents; `bg-slate-900 text-white` for dark notification banners; `rounded-2xl` for toast cards; `ring-2 ring-amber-400` or `bg-amber-50` for freeze event highlight

### Updated Supabase RPC

```sql
-- Replace (CREATE OR REPLACE) the existing function from Story 3.2
CREATE OR REPLACE FUNCTION public.increment_pallet_bottle_count(
  p_pallet_id uuid,
  p_quantity  integer,
  OUT new_count integer,
  OUT new_state text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_threshold integer;
BEGIN
  -- Validate quantity
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be positive';
  END IF;

  -- Increment and conditionally freeze in a single atomic UPDATE
  UPDATE public.virtual_pallets
  SET
    bottle_count = bottle_count + p_quantity,
    state        = CASE
                     WHEN bottle_count + p_quantity >= threshold THEN 'frozen'
                     ELSE state
                   END,
    updated_at   = now()
  WHERE id = p_pallet_id
    AND state = 'open'
  RETURNING bottle_count, state INTO new_count, new_state;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pallet % not found or not open', p_pallet_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_pallet_bottle_count(uuid, integer)
  TO authenticated;
```

> **Note**: PostgreSQL OUT parameters make the function return a single row with two columns (`new_count`, `new_state`). The Supabase RPC client returns this as `{ new_count: number, new_state: string }`.

### Updated Data Access Layer

```typescript
// Modify src/lib/supabase/queries/virtualPallets.ts

// Update addOrderToPallet return type:
export const addOrderToPallet = async (
  palletId: string,
  buyerId: string,
  quantity: number,
  wineLabel?: string,
  notes?: string
): Promise<{ newCount: number; newState: 'open' | 'frozen' }> => {
  const { error: insertError } = await supabase
    .from('pallet_orders')
    .insert({ pallet_id: palletId, buyer_id: buyerId, quantity, wine_label: wineLabel, notes })
  if (insertError) throw insertError

  const { data, error: rpcError } = await supabase
    .rpc('increment_pallet_bottle_count', { p_pallet_id: palletId, p_quantity: quantity })
  if (rpcError) throw rpcError

  const result = data as { new_count: number; new_state: string }
  return {
    newCount: result.new_count,
    newState: result.new_state as 'open' | 'frozen',
  }
}

// Add order lookup for notification eligibility check:
export const buyerHasOrderOnPallet = async (
  palletId: string,
  buyerId: string
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('pallet_orders')
    .select('id')
    .eq('pallet_id', palletId)
    .eq('buyer_id', buyerId)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data !== null
}
```

### AddOrderModal Callback Signature Change

```typescript
// src/pages/pallets/AddOrderModal.tsx — update props interface:
interface AddOrderModalProps {
  pallet: VirtualPallet
  buyerUserId: string
  onClose: () => void
  onOrderAdded: (newCount: number, newState: 'open' | 'frozen') => void  // ← changed
}

// Inside the submit handler, destructure both values:
const { newCount, newState } = await addOrderToPallet(...)
onOrderAdded(newCount, newState)
```

### BuyerDashboard handleOrderAdded Update

```typescript
// Update the local state handler to apply both count and state:
const handleOrderAdded = (palletId: string, newCount: number, newState: 'open' | 'frozen') => {
  setPallets(prev => prev.map(p =>
    p.palletId === palletId
      ? {
          ...p,
          bottles: newCount,
          progress: palletProgressLabel(newCount, 600),
          state: newState,
        }
      : p
  ))
}
```

### In-App Notification System

```typescript
// Notification type:
interface PalletFreezeNotification {
  id: string           // ephemeral, use crypto.randomUUID()
  palletId: string
  wineryName: string
  areaName: string
}

// State in BuyerDashboard:
const [notifications, setNotifications] = useState<PalletFreezeNotification[]>([])

// Extend the existing Realtime handler (Story 3.2) to check freeze events:
// Inside the 'postgres_changes' UPDATE handler, after updating pallets state:
if (updated.state === 'frozen') {
  buyerHasOrderOnPallet(updated.id, user!.id)
    .then(hasOrder => {
      if (hasOrder) {
        setNotifications(prev => [...prev, {
          id: crypto.randomUUID(),
          palletId: updated.id,
          wineryName: /* look up from pallets state */ '',
          areaName: activeAreaName ?? '',
        }])
      }
    })
    .catch(() => {/* non-blocking */})
}

const dismissNotification = (id: string) =>
  setNotifications(prev => prev.filter(n => n.id !== id))
```

### FreezeNotification Component

```tsx
// src/components/notifications/FreezeNotification.tsx  (NEW)
interface FreezeNotificationProps {
  wineryName: string
  areaName: string
  onDismiss: () => void
}

const FreezeNotification = ({ wineryName, areaName, onDismiss }: FreezeNotificationProps) => (
  <div
    role="alert"
    className="flex items-start gap-4 rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg ring-1 ring-amber-400/60"
  >
    <div className="flex-1">
      <p className="text-sm font-semibold text-amber-300">Pallet Frozen 🧊</p>
      <p className="mt-1 text-sm text-slate-200">
        Pallet for <span className="font-medium">{wineryName}</span> in{' '}
        <span className="font-medium">{areaName}</span> has been frozen!
      </p>
    </div>
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss notification"
      className="text-slate-400 hover:text-white"
    >
      ×
    </button>
  </div>
)

export default FreezeNotification
```

Render in `BuyerDashboard.tsx` as a fixed-position stack:
```tsx
{/* Notification stack — place just before closing </div> of root wrapper */}
<div className="fixed right-4 top-4 z-50 flex flex-col gap-3 w-80">
  {notifications.map(n => (
    <FreezeNotification
      key={n.id}
      wineryName={n.wineryName}
      areaName={n.areaName}
      onDismiss={() => dismissNotification(n.id)}
    />
  ))}
</div>
```

### Regression Risk

- **RPC signature change**: the return type of `increment_pallet_bottle_count` changes from `integer` (single scalar) to a composite row `(new_count integer, new_state text)`. The `addOrderToPallet` function in Story 3.2 accessed `data` as a raw number — this must be updated to destructure `data.new_count`. Any test mocking the RPC must also be updated.
- **`AddOrderModal` callback signature**: the `onOrderAdded` prop changes from `(newCount: number) => void` to `(newCount: number, newState: 'open' | 'frozen') => void`. Update the call site in `BuyerDashboard.tsx` and any test that mounts `AddOrderModal`.
- **Freeze guard in RPC**: the `WHERE state = 'open'` clause ensures the freeze cannot be applied twice. However, if `addOrderToPallet`'s INSERT succeeds but the RPC then finds the pallet already frozen (race condition), the insert is orphaned. This is the known limitation flagged in Story 3.2, fully addressed in Story 3.4.
- **Notification winery name lookup**: the Realtime payload for `virtual_pallets` UPDATE does not include joined fields. The winery name must be resolved from the current `pallets` local state array by matching `palletId`. Ensure the lookup happens before `setPallets` replaces the state item, or find the name from the old state.

### Project Structure Notes

```
src/
├── components/
│   └── notifications/
│       └── FreezeNotification.tsx          ← NEW
├── lib/
│   ├── palletProgress.ts                   ← do not modify (Story 3.1)
│   └── supabase/
│       └── queries/
│           └── virtualPallets.ts           ← MODIFY: update addOrderToPallet return type,
│                                               add buyerHasOrderOnPallet
├── pages/
│   ├── dashboards/
│   │   └── BuyerDashboard.tsx             ← MODIFY: handleOrderAdded (state), Realtime freeze
│   │                                          detection, notification state + render
│   └── pallets/
│       └── AddOrderModal.tsx               ← MODIFY: onOrderAdded signature, pass newState
└── (Supabase)
    └── increment_pallet_bottle_count RPC   ← MODIFY: CREATE OR REPLACE with OUT params
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 3.3: Automatic Pallet Freezing]
- [Source: _bmad-output/planning-artifacts/epics-stories.md#Epic 3: Virtual Pallet Pooling]
- [Source: _bmad-output/planning-artifacts/prd.md#4.2. Geographic Pooling Engine] — Threshold Management (FR4)
- [Source: _bmad-output/planning-artifacts/prd.md#8. Non-Functional Requirements] — NFR1 concurrency
- [Source: _bmad-output/planning-artifacts/Epic3/story_3.2.md] — `increment_pallet_bottle_count` RPC definition, `addOrderToPallet`, `AddOrderModal` props, Realtime subscription pattern in `BuyerDashboard`
- [Source: _bmad-output/planning-artifacts/Epic3/story_3.1.md] — `virtual_pallets` schema, `BuyerPalletCard`, `palletProgress.ts`
- [Source: winepooler/src/lib/supabase/client.ts] — Supabase client import

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

No blockers encountered.

### Completion Notes List

- Created migration `20260401005000_update_increment_rpc_auto_freeze.sql` using `CREATE OR REPLACE FUNCTION` with PostgreSQL OUT params (`new_count`, `new_state`). The single atomic UPDATE now applies `state = 'frozen'` when `bottle_count + p_quantity >= threshold`, keeping the `WHERE state = 'open'` guard to prevent double-freeze.
- Updated `addOrderToPallet` in `virtualPallets.ts` to return `{ newCount, newState }` by destructuring `data.new_count` and `data.new_state` from the RPC response. Added `buyerHasOrderOnPallet(palletId, buyerId)` querying `pallet_orders` with `.limit(1).maybeSingle()`.
- Updated `AddOrderModal` props interface: `onOrderAdded: (newCount: number, newState: 'open' | 'frozen') => void`. Changed submit handler to destructure `{ newCount, newState }` from `addOrderToPallet` and forwards both to callback.
- Created `FreezeNotification.tsx` component: dark `bg-slate-900` card with amber ring, dismissible ✕ button, winery + area name in message, `role="alert"` for accessibility.
- Updated `BuyerDashboard.tsx`: added `PalletFreezeNotification` interface, `notifications` state, `palletsRef` (synced via `useEffect`) to give Realtime handler fresh access to pallet state. Extended Realtime UPDATE handler to detect `state === 'frozen'`, look up winery name from `palletsRef.current`, call `buyerHasOrderOnPallet` (non-blocking), and push to `notifications`. Updated `handleOrderAdded` to apply `state: newState`. Added `dismissNotification` helper. Updated `AddOrderModal` call site to forward `newState`. Added fixed notification stack render.
- Updated `virtualPallets.test.ts`: `addOrderToPallet` now mocks `{ new_count, new_state }` and asserts `newCount`/`newState` in result; added `frozen` boundary test; added `buyerHasOrderOnPallet` tests (true/false).
- Updated `AddOrderModal.test.tsx`: success mock returns `{ newCount, newState }`, asserts `onOrderAdded` called with both; added explicit `frozen` boundary test.
- Updated `BuyerDashboard.test.tsx`: added `buyerHasOrderOnPallet` to mock factory and default `false` in `beforeEach`; added two Realtime freeze notification tests (shown when buyer has order, hidden when not).
- Created `FreezeNotification.test.tsx`: 3 tests covering render, dismiss callback, and full message content.

### File List

- winepooler/supabase/migrations/20260401005000_update_increment_rpc_auto_freeze.sql (new)
- winepooler/src/lib/supabase/queries/virtualPallets.ts (modified)
- winepooler/src/pages/pallets/AddOrderModal.tsx (modified)
- winepooler/src/components/notifications/FreezeNotification.tsx (new)
- winepooler/src/pages/dashboards/BuyerDashboard.tsx (modified)
- winepooler/src/lib/supabase/queries/__tests__/virtualPallets.test.ts (modified)
- winepooler/src/pages/pallets/__tests__/AddOrderModal.test.tsx (modified)
- winepooler/src/components/notifications/__tests__/FreezeNotification.test.tsx (new)
- winepooler/src/pages/dashboards/__tests__/BuyerDashboard.test.tsx (modified)
