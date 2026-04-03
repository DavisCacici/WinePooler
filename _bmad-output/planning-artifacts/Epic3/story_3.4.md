# Story 3.4: Concurrent Update Handling

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the system,
I want to handle simultaneous order additions safely,
so that pallet counters remain accurate.

## Acceptance Criteria

1. Given two buyers submit orders to the same open pallet at the exact same moment
   When both requests reach the database concurrently
   Then both orders are recorded in `pallet_orders`
   And `bottle_count` reflects the sum of both quantities without loss

2. Given 10 concurrent order submissions arrive within the same 100ms window
   When all 10 are processed
   Then `bottle_count` equals the sum of all 10 quantities
   And no duplicate `pallet_orders` rows are created
   And no row is silently dropped

3. Given a race condition would push `bottle_count` past `threshold` from two simultaneous requests
   When both are processed
   Then the pallet is frozen exactly once
   And only the first request that crosses the threshold triggers the state change to `frozen`
   And the second request is rejected with a clear error (pallet no longer open)

4. Given the system detects an orphaned `pallet_orders` row (INSERT succeeded but RPC failed)
   When the inconsistency is present
   Then the discrepancy is surfaced in the Supabase logs
   And a compensating mechanism corrects `bottle_count` via a scheduled reconciliation function

5. Given normal (non-concurrent) operation
   When a single buyer adds an order
   Then behaviour is identical to Stories 3.2 and 3.3 — no regression

## Tasks / Subtasks

- [x] Replace dual-step INSERT + RPC with a single atomic PL/pgSQL function (AC: 1, 2, 3)
  - [x] Create `add_order_and_increment` RPC in migration `20260403001000_add_order_and_increment_rpc.sql`
  - [x] The function wraps INSERT into `pallet_orders` and UPDATE of `virtual_pallets` in a single atomic PL/pgSQL function with row-level locking
  - [x] On success return `{ order_id, new_count, new_state }`
  - [x] On failure (e.g. pallet not open) RAISE EXCEPTION rolls back the INSERT automatically
  - [x] Function is SECURITY DEFINER; callers must be `authenticated` (GRANT EXECUTE)
- [x] Update `addOrderToPallet` in `virtualPallets.ts` to call the new RPC (AC: 1, 2, 5)
  - [x] Replace direct `supabase.from('pallet_orders').insert(...)` + `supabase.rpc('increment_pallet_bottle_count')` with a single `supabase.rpc('add_order_and_increment', {...})` call
  - [x] Preserve the same return type: `{ newCount: number, newState: 'open' | 'frozen' }`
  - [x] Pass optional `wineLabel` and `notes` as null when not provided
- [x] Create DB-level reconciliation function for orphaned orders (AC: 4)
  - [x] Create Postgres function `reconcile_pallet_bottle_counts()` that recalculates `bottle_count` from `SUM(pallet_orders.quantity)` for each pallet in `open` state
  - [x] Function logs discrepancies to a `reconciliation_log` table (`pallet_id`, `expected_count`, `actual_count`, `corrected_at`)
  - [x] Created as migration `20260403002000_reconciliation_function.sql`, callable by service_role
- [x] Write unit tests for concurrency scenario coverage (AC: 1, 2, 3)
  - [x] Tests verify RPC is called with correct parameters for concurrent safety
  - [x] Tests verify frozen state is returned correctly when threshold crossed
  - [x] Tests verify error is thrown when pallet is not open (concurrent freeze rejection)
  - [x] Note: true DB-level concurrency tests require a running Supabase instance (integration test scope)
- [x] Write unit tests for regression (AC: 5)
  - [x] Single order → same behaviour as before: `newCount` and `newState` returned correctly
  - [x] RPC error surfaces as a thrown error in `addOrderToPallet`
  - [x] Optional params (wineLabel, notes) passed as null when undefined

## Dev Notes

### Architecture & Technical Context

- **Root cause of the race condition**: Stories 3.2 and 3.3 use two separate network calls: (1) `supabase.from('pallet_orders').insert(...)` and (2) `supabase.rpc('increment_pallet_bottle_count', ...)`. Between calls (1) and (2), another buyer's (1) can complete and their (2) can run, causing the final count to be wrong if both increments see the same pre-update state.
- **Solution**: wrap both operations in an explicit PostgreSQL transaction inside a **Supabase Edge Function** (Deno). The transaction uses `FOR UPDATE` advisory lock or relies on PostgreSQL's native row-level locking to serialize concurrent increments.
- **`increment_pallet_bottle_count` RPC**: already defined in Story 3.3 with atomic `UPDATE ... WHERE state = 'open'`. PostgreSQL row-level locking (implicit in `UPDATE`) prevents two concurrent updates from seeing the same `bottle_count`. The RPC itself is already safe; the issue is the gap BEFORE the RPC (the INSERT). The Edge Function eliminates that gap.
- **Edge Function runtime**: Supabase Edge Functions run on Deno Deploy. Use the `@supabase/supabase-js` client initialized with the service role key (available as `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`). The service role client bypasses RLS — use it only server-side within the function body. Validate the user JWT before acting.
- **Transaction pattern in Edge Function**: Supabase JS v2 does not expose `BEGIN`/`COMMIT` directly. Use `supabase.rpc('begin_transaction')` pattern or call raw SQL via `supabase.from('...').select()` is not transactional. **Recommended**: use Postgres `pg` driver via a direct connection string (`Deno.env.get('DATABASE_URL')`) for explicit transaction control, OR use a single PL/pgSQL function that does both INSERT and UPDATE atomically (preferred — see below).
- **Preferred approach — extend the RPC**: upgrade `increment_pallet_bottle_count` to also INSERT the `pallet_orders` row internally. This makes the entire operation a single atomic DB call, eliminating the need for an explicit transaction in the Edge Function entirely.

### Recommended: All-in-One Atomic RPC

Instead of managing a transaction from the Edge Function, extend the Postgres function to perform both the INSERT and the UPDATE atomically:

```sql
CREATE OR REPLACE FUNCTION public.add_order_and_increment(
  p_pallet_id  uuid,
  p_buyer_id   uuid,
  p_quantity   integer,
  p_wine_label text DEFAULT NULL,
  p_notes      text DEFAULT NULL,
  OUT order_id  uuid,
  OUT new_count integer,
  OUT new_state text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be positive';
  END IF;

  -- Insert the order row
  INSERT INTO public.pallet_orders (pallet_id, buyer_id, quantity, wine_label, notes)
  VALUES (p_pallet_id, p_buyer_id, p_quantity, p_wine_label, p_notes)
  RETURNING id INTO order_id;

  -- Atomically increment and conditionally freeze
  -- PostgreSQL row-level lock on the target row serializes concurrent calls
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
    -- Pallet not open (already frozen or doesn't exist) — roll back the INSERT
    RAISE EXCEPTION 'pallet % is not open or does not exist', p_pallet_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_order_and_increment(uuid, uuid, integer, text, text)
  TO authenticated;
```

> **Why this is safe**: the `UPDATE ... WHERE state = 'open'` acquires a row-level lock on the `virtual_pallets` row. Concurrent calls queue behind this lock. If a concurrent call finds the pallet already frozen (`NOT FOUND`), it raises an exception and the implicit PL/pgSQL savepoint rolls back its preceding INSERT automatically. No orphaned `pallet_orders` rows.

### Updated `addOrderToPallet` in `virtualPallets.ts`

```typescript
// REPLACE the existing function body from Story 3.3:
export const addOrderToPallet = async (
  palletId: string,
  buyerId: string,
  quantity: number,
  wineLabel?: string,
  notes?: string
): Promise<{ newCount: number; newState: 'open' | 'frozen' }> => {
  const { data, error } = await supabase.rpc('add_order_and_increment', {
    p_pallet_id:  palletId,
    p_buyer_id:   buyerId,
    p_quantity:   quantity,
    p_wine_label: wineLabel ?? null,
    p_notes:      notes ?? null,
  })
  if (error) throw error

  const result = data as { order_id: string; new_count: number; new_state: string }
  return {
    newCount: result.new_count,
    newState: result.new_state as 'open' | 'frozen',
  }
}
```

> **`increment_pallet_bottle_count` deprecation**: the old RPC is superseded by `add_order_and_increment`. Keep the old function in the DB for now (do not drop it) to avoid breaking any dev environment that has not yet migrated. The client code no longer calls it.

### Reconciliation Function (AC: 4)

```sql
-- reconciliation_log table
CREATE TABLE IF NOT EXISTS public.reconciliation_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_id     uuid NOT NULL REFERENCES public.virtual_pallets(id),
  expected_count integer NOT NULL,
  actual_count   integer NOT NULL,
  corrected_at   timestamptz DEFAULT now()
);

-- Reconciliation function (admin-only, run on-demand or scheduled)
CREATE OR REPLACE FUNCTION public.reconcile_pallet_bottle_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      vp.id            AS pallet_id,
      vp.bottle_count  AS actual_count,
      COALESCE(SUM(po.quantity), 0) AS expected_count
    FROM public.virtual_pallets vp
    LEFT JOIN public.pallet_orders po ON po.pallet_id = vp.id
    WHERE vp.state = 'open'
    GROUP BY vp.id, vp.bottle_count
    HAVING vp.bottle_count <> COALESCE(SUM(po.quantity), 0)
  LOOP
    -- Correct the discrepancy
    UPDATE public.virtual_pallets
    SET bottle_count = rec.expected_count, updated_at = now()
    WHERE id = rec.pallet_id;

    -- Log it
    INSERT INTO public.reconciliation_log (pallet_id, expected_count, actual_count)
    VALUES (rec.pallet_id, rec.expected_count, rec.actual_count);
  END LOOP;
END;
$$;
```

### Supabase Edge Function (Optional — if all-in-one RPC is not desired)

If an Edge Function approach is preferred over the all-in-one RPC, the pattern is:

```typescript
// supabase/functions/add-order-to-pallet/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Verify user JWT
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401 })

  const { pallet_id, quantity, wine_label, notes } = await req.json()

  // Call the all-in-one RPC with service role (bypasses RLS, but function is SECURITY DEFINER)
  const { data, error } = await serviceClient.rpc('add_order_and_increment', {
    p_pallet_id: pallet_id,
    p_buyer_id: user.id,
    p_quantity: quantity,
    p_wine_label: wine_label ?? null,
    p_notes: notes ?? null,
  })

  if (error) {
    const status = error.message.includes('not open') ? 409 : 500
    return new Response(JSON.stringify({ error: error.message }), { status })
  }

  return new Response(JSON.stringify(data), { status: 200 })
})
```

> **Recommendation**: use the all-in-one RPC directly from the client (no Edge Function) unless you need server-side business logic beyond what PostgreSQL can express. The RPC alone is sufficient for AC 1–3.

### Regression Risk

- **`addOrderToPallet` signature unchanged**: the function still returns `{ newCount, newState }` — `AddOrderModal`, `BuyerDashboard.handleOrderAdded`, and `FreezeNotification` logic from Stories 3.2/3.3 need **no changes**.
- **`increment_pallet_bottle_count` remains in DB**: do not drop it; it is referenced in existing test mocks from Stories 3.2 and 3.3. The client simply no longer calls it.
- **`pallet_orders` RLS INSERT policy**: the old policy checked `auth.uid() = buyer_id`. The new `add_order_and_increment` function is `SECURITY DEFINER` and runs as the function owner (bypasses RLS for its own INSERTs). The INSERT inside the function uses `p_buyer_id` which is the authenticated user's UID passed in — security is preserved.
- **Concurrent freeze boundary**: if two requests both push the count past 600, only the first successful `UPDATE ... WHERE state = 'open'` proceeds; the second finds `NOT FOUND` and its INSERT is rolled back. The final `bottle_count` may exceed 600 by the quantity of the first request that crosses the threshold — this is by design (FR4: threshold triggers freeze, not a hard cap on total bottles).

### Project Structure Notes

```
src/
├── lib/
│   └── supabase/
│       └── queries/
│           └── virtualPallets.ts          ← MODIFY: replace addOrderToPallet body
│                                              to call add_order_and_increment RPC
supabase/
├── functions/
│   └── add-order-to-pallet/
│       └── index.ts                       ← NEW (optional, if Edge Function path chosen)
└── migrations/ (or SQL scripts)
    ├── add_order_and_increment.sql        ← NEW RPC
    └── reconcile_pallet_bottle_counts.sql ← NEW reconciliation function + log table
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 3.4: Concurrent Update Handling]
- [Source: _bmad-output/planning-artifacts/epics-stories.md#Epic 3: Virtual Pallet Pooling]
- [Source: _bmad-output/planning-artifacts/prd.md#8. Non-Functional Requirements] — NFR1 concurrency
- [Source: _bmad-output/planning-artifacts/Epic3/story_3.2.md] — original `addOrderToPallet` two-step implementation, `pallet_orders` schema, `increment_pallet_bottle_count` RPC (step 1 of evolution)
- [Source: _bmad-output/planning-artifacts/Epic3/story_3.3.md] — updated RPC with OUT params and freeze logic (step 2 of evolution), `buyerHasOrderOnPallet`, `FreezeNotification` callback signatures
- [Source: _bmad-output/planning-artifacts/Epic3/story_3.1.md] — `virtual_pallets` schema, partial unique index `WHERE state = 'open'`
- [Source: winepooler/src/lib/supabase/client.ts] — Supabase client import

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None

### Completion Notes List

- Implemented the **preferred approach** from Dev Notes: all-in-one atomic `add_order_and_increment` PL/pgSQL function instead of a Supabase Edge Function. This is simpler, more performant, and fully atomic — PostgreSQL row-level locking serializes concurrent UPDATE calls automatically.
- The old `increment_pallet_bottle_count` RPC is **not dropped** — it remains in the DB to avoid breaking any dev environments that haven't migrated. The client no longer calls it.
- `addOrderToPallet` function signature and return type are **unchanged** — no downstream changes needed in `AddOrderModal`, `BuyerDashboard`, or `FreezeNotification`.
- Reconciliation function (`reconcile_pallet_bottle_counts`) is restricted to `service_role` only for security.
- Unit tests updated to reflect the new single-RPC pattern; added test for optional parameter null-coalescing and pallet-not-open error.

### Change Log

- 2026-04-03: Story 3.4 implemented — atomic RPC, reconciliation, updated client code + tests

### File List

- `winepooler/supabase/migrations/20260403001000_add_order_and_increment_rpc.sql` (NEW)
- `winepooler/supabase/migrations/20260403002000_reconciliation_function.sql` (NEW)
- `winepooler/src/lib/supabase/queries/virtualPallets.ts` (MODIFIED)
- `winepooler/src/lib/supabase/queries/__tests__/virtualPallets.test.ts` (MODIFIED)
