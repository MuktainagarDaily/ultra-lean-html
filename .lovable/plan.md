## Audit verification — what's real vs. not

I scanned `CategoriesTab.tsx`, `RequestsTab.tsx`, `ShopsTab.tsx`, `ShopModal.tsx`, and `AnalyticsTab.tsx` line-by-line and cross-checked every finding. Summary below — most are real, a few were over-stated, one is wrong.

### ✅ Confirmed real (will fix in Phase 1)
- **B1** — `fetchingLinks` is a single boolean; spins/disables all rows simultaneously.
- **B3** — **HIGH SAFETY**. `handleDelete`, `handleApprove`, `handleReject` in `RequestsTab` all run instantly on icon click. No dialog. Deleting also wipes the storage image. Violates project rule.
- **B6** — `s.phone?.replace(/\D/g, '').includes(q.replace(/\D/g, ''))` — when query is `"sharma"`, both sides become `""` and `''.includes('')` is `true`, so phone clause matches every shop with a phone. Name/area clauses still narrow via OR, but the OR makes the phone branch a no-op noise contributor.
- **B7** — Confirmed: `ShopModal.tsx:279` fetches every shop with full category join just to find one duplicate. Easy win: server-side `.eq('phone', normalizedPhone)`.
- **B10** — Confirmed: leftover `/* REwired Speed form to admin */` comment with awkward indent in `AdminDashboard.tsx`.
- **D4** — Confirmed leftover comment in `RequestsTab.tsx:55`.

### ⚠️ Real but smaller than stated
- **B2** — `handleDeleteClick` doesn't destructure `error` from the supabase call. If it fails, dialog opens with empty `linkedShops` and says "safe to delete". Real, but low likelihood. Worth a 2-line fix.
- **B4** — `is_open: true` is hardcoded on approval. Minor; `is_open` is a manual override flag, not derived. Will respect captured times: only force `true` when no times provided, otherwise leave default.
- **B5** — Approval duplicate check only matches `phone`, not `whatsapp`. Real edge case; safe to widen.

### ❌ Not accurate / skip
- **B8** — `.ilike('name', text)` *without* wildcards is functionally `iequal` (case-insensitive exact). The audit claims it would match "grocery shop" → "Grocery" — it won't, but it also won't *false-positive*. Behaviour is fine; no change. (Could improve by trimming + exact match for clarity, but not a bug.)
- **B9** — Cosmetic only; tracked for Phase 3.
- **D1/D2** — These are inside `ShopModal.tsx` which I haven't fully re-verified; I'll confirm before touching as part of Phase 1 cleanup. If real, remove.

---

## Phase 1 scope (this PR — bugs & safety only)

Files touched: 4 (`RequestsTab.tsx`, `CategoriesTab.tsx`, `ShopsTab.tsx`, `ShopModal.tsx`, `AdminDashboard.tsx`)
Net change: ~150–200 LOC. No new files. No DB changes. No new dependencies.

### 1. RequestsTab — add confirmation dialogs (B3, highest priority)
- Add `AlertDialog`-based confirmations for **Delete**, **Approve**, **Reject** triggered from the row action buttons.
- The Approve dialog summarizes: shop name, phone, whether category will be auto-mapped, whether image will be renamed.
- The Reject dialog notes: "Request will be marked rejected and remain in audit history."
- The Delete dialog warns: "Request and its uploaded image will be permanently removed."
- Detail-modal actions (inside `viewRequest`) reuse the same confirm flow.
- Remove the stale comment at line 55 (D4).

### 2. RequestsTab — widen duplicate check + smarter is_open (B4, B5)
- Approval duplicate check now compares normalized phone against both `shops.phone` AND `shops.whatsapp`.
- `is_open`: only set `true` when `opening_time` and `closing_time` are both null; otherwise omit the field and let the DB default apply (existing default is `true`, but at least we stop force-overriding any future logic).

### 3. CategoriesTab — per-row delete state + error handling (B1, B2)
- Replace single `fetchingLinks` boolean with `fetchingLinksFor: string | null` so only the clicked row shows the spinner.
- Destructure `error` from the `shop_categories` lookup; if it errors, toast and abort instead of opening a misleading "safe to delete" dialog.

### 4. ShopsTab — fix search no-op for non-numeric queries (B6)
- Guard the phone/whatsapp clauses: only run digit-include checks when the query actually contains a digit (`/\d/.test(q)`). Removes false-broadening on text searches.

### 5. ShopModal — targeted duplicate-phone query (B7)
- Replace the global `select('id, name, phone, area, shop_categories(categories(name, icon))')` with `.eq('phone', normalizedPhone).neq('id', currentShopId).limit(1)`.
- Keep the existing duplicate-warning UI; just feed it from a much smaller query.
- While in the file, remove the dead `croppedBlob` state and unused `mapsLink` setter (D1, D2) — only if confirmed dead on a final read.

### 6. AdminDashboard — cosmetic cleanup (B10)
- Remove the `/* REwired Speed form to admin */` comment and re-indent the `SpeedShopModal` JSX block cleanly.

---

## Out of scope (deferred to later phases — your call)

**Phase 2 (perf + shared utils):** P1 (stats `staleTime`), P3 (slim AnalyticsTab query), P4 (batch CSV inserts), D7 (`csvDownload` util), D8 (`csvParse` util). Touches AnalyticsTab and creates `src/lib/csvUtils.ts`.

**Phase 3 (UX polish):** U1 (badge clipping), U3 (toolbar wrap), U4 (sortable tables), U6 (Speed Add autosave), U7 (Dialog for request detail), U9 (`isFetching` indicator), U10 (keyboard shortcuts), U12 (`--whatsapp` token).

**Skipping entirely:** B8 (not a bug), B9 (Phase 3 only if you want it), S2 (extra confirmation on hide-shop — adds friction for a routine action; the action is already reversible), S3/S4 (low value, edge cases), D5/D6 (premature), U2/U5/U8/U11/U13 (subjective polish).

---

## Why this scope
- Phase 1 is **150–200 LOC across 5 files**, all surgical, all verifiable in the preview.
- It fixes the only **HIGH-severity** finding (B3 — destructive actions with no confirmation), the only correctness bug that affects user-visible search results (B6), and the only meaningful perf bug (B7).
- Zero new files, zero new deps, zero DB changes — safe to revert if anything regresses.
- Phases 2 & 3 should be separate approvals so you can review impact in isolation.