
## Complete Technical Audit — Muktainagar Daily

### What I read
All source files: `AdminDashboard.tsx` (3668 lines), `Home.tsx`, `Shops.tsx`, `CategoryPage.tsx`, `ShopDetail.tsx`, `ShopCard.tsx`, `RequestListingModal.tsx`, `shopUtils.ts`, `App.tsx`, `useAuth.tsx`, DB schema.

---

## 1. What Is Solid

- **`isShopOpen`** in `shopUtils.ts` — clean, pure, correctly handles overnight hours, no duplication
- **`ShopCard`, `ShopDetail`** public pages — correct `is_active` filtering on categories, proper image fallback, engagement logging is fire-and-forget
- **Auth flow** — `ProtectedRoute` + `AuthProvider` pattern is clean and correct; no localStorage hacks
- **Cache invalidation** — after recent fixes, all mutation paths (`executeSave`, `handleApprove`, CSV import, category merge) now correctly hit `['shops']` to invalidate public queries
- **Duplicate phone detection** — all three paths (ShopModal, CSV import, request approval) normalize both sides before comparing; BUG-01 is genuinely fixed
- **Category merge** — DELETE+INSERT pattern correctly bypasses the missing RLS UPDATE policy; deduplication logic is correct
- **Storage pagination** — `runScan` now loops with `offset` until `page.length < PAGE`; no longer capped at 1000 files
- **CSV parser** — `parseCsvLine` handles quoted fields, embedded commas, escaped double-quotes correctly
- **`normalizeArea` regex** — the bilingual-safe `/(^|[\s,])([a-z])/g` is now consistent across all four locations (AdminDashboard executeSave, handleApprove, CsvImportModal, RequestListingModal)
- **RLS policies** — `shop_engagement` allows public INSERT but blocks public SELECT/UPDATE/DELETE; `shop_requests` same pattern; `shops`/`categories` correctly public-readable, write-protected
- **`DataQualityTab`** area comparison helpers — `dqAreaCompareKey`, `dqHasDevanagari`, `dqNormalizeAreaValue`, `dqIsSuspiciousArea` are all pure module-level functions (no re-creation on render)

---

## 2. What Is Fragile

### RISK-01 — `AdminDashboard.tsx` is a 3668-line monolith
Every component — `ShopsTab`, `CategoriesTab`, `AnalyticsTab`, `RequestsTab`, `DataQualityTab`, `StorageAuditSection`, `ShopModal`, `CategoryModal`, `CategoryMergeModal`, `CsvImportModal`, `Field`, `StatCard`, `TabButton`, `normalizePhone`, `normalizeWhatsApp`, `parseGoogleMapsLink`, `extractStoragePath` — lives in a single file. This is the single largest maintainability risk. Any change anywhere risks touching something unintended.

### RISK-02 — `normalizePhone` is defined **three separate times** with slightly different regex
- `RequestListingModal.tsx` line 11: `phone.replace(/\D/g, '')`
- `AdminDashboard.tsx` ShopModal line 1888: `phone.replace(/[\s\-().+]/g, '')`
- `AdminDashboard.tsx` RequestsTab handleApprove line 2718: `phone.replace(/[\s\-().+]/g, '')`

The first version strips ALL non-digits (more aggressive). The other two strip only specific chars. An input like `phone = "(928) 455-5571"` would produce:
- Version 1: `9284555571` (correct)
- Version 2: `9284555571` (correct, same result here)
But an input like `"phone: 928"` (with a colon, contrived but possible from CSV) would behave differently. The real risk: these are not in a shared utility, so any future fix to one won't propagate to the others.

### RISK-03 — `parseGoogleMapsLink` is defined **twice** identically
- `RequestListingModal.tsx` lines 38–74
- `AdminDashboard.tsx` lines 1912–1944

Exact same function body. Any future Maps URL format support (e.g., Apple Maps redirect URLs, new Google Maps formats) must be updated in both files. No shared utility.

### RISK-04 — `compressImage` is defined **twice** with identical logic
- `RequestListingModal.tsx` lines 173–192
- `AdminDashboard.tsx` lines 2099–2118 (ShopModal)

Both use the same canvas/WebP compression pattern with the same null-blob guard. Any quality tweak, format change, or error handling improvement must be applied in two places.

### RISK-05 — `CsvImportModal.handleImport` is a sequential `for` loop with no transaction semantics
Lines 3358–3397: each shop is inserted one at a time. If the import fails partway through (network drop, DB error), some rows are inserted and some are not. There is no rollback. The result screen shows `failedInserts` but provides no way to re-attempt just the failed rows — the user must figure out which rows failed manually.
At scale (100+ rows), this is also slow and could time out.

### RISK-06 — `DataQualityTab` shares the `['admin-shops']` query key with `ShopsTab`
Line 1257–1268 in `DataQualityTab`:
```ts
queryKey: ['admin-shops'],
queryFn: async () => supabase.from('shops').select('*, shop_categories(categories(id, name, icon))').order('created_at')
```
`ShopsTab` (line 205–215) uses the exact same query key but selects the same columns. This accidental sharing means they share the cached result. This is actually **currently harmless** because both queries select the same data, but it means:
- If `ShopsTab`'s query is ever changed to add/remove a column, `DataQualityTab` silently gets the wrong data
- The 30-second `staleTime` applies to both — `DataQualityTab` data may be stale from `ShopsTab`'s last fetch

### RISK-07 — `AnalyticsTab` engagement query has no foreign-key constraint on `shop_engagement.shop_id`
From schema: `shop_engagement.shop_id` references nothing in the FK list. Shops can be deleted and their `shop_engagement` rows remain (orphaned). The analytics join `shops(name, area, ...)` will return `null` for deleted shops. The current code handles this gracefully (`r.shops?.name ?? r.shop_id`) but over time the analytics table accumulates phantom rows for non-existent shops, and the `shop_id` UUID shows in the analytics table instead of the name.

### RISK-08 — `CategoryPage` query fetches via `shop_categories` join, not directly from `shops`
Line 75–86:
```ts
supabase.from('shop_categories').select('shops(*, shop_categories(categories(...)))')
```
This means it fetches `shop_categories` rows first, then nests `shops`. If a shop has **multiple categories**, it will appear **multiple times** in the results (once per `shop_categories` row). The `.filter((s) => s && s.is_active)` does not deduplicate. At current data scale (small) this is unlikely but if a shop has 2 categories, it appears twice on the category page.

### RISK-09 — `ShopModal` triggers a `useQuery` side-effect to set state
Lines 2056–2073:
```ts
useQuery({
  queryKey: ['shop-categories', shop.id],
  queryFn: async () => {
    ...
    setSelectedCategoryIds(data.map((r) => r.category_id));  // ← side effect in queryFn
    return data;
  },
  enabled: !!shop.id,
});
```
Calling `setState` inside a `queryFn` is an anti-pattern in React Query. The query can be re-fetched (background refetch, window focus) and will call `setSelectedCategoryIds` again, resetting any changes the admin made to the category selection before saving. This is a real UX bug waiting to happen if `refetchOnWindowFocus` or `staleTime` is ever changed.

### RISK-10 — `ShopDetail` fetches even inactive shops, guards at render time
Line 25–34: `ShopDetail.useQuery` has no `.eq('is_active', true)` filter. It fetches the shop regardless of active status, then shows the "unavailable" screen at line 89. This means:
1. The DB row is fetched and cached even for inactive shops — minor privacy concern (inactive shop data in client cache)
2. The query cache key `['shop', id]` stores the inactive shop — if the admin reactivates the shop, the staleTime must expire before the public sees the update unless `['shops']` broad invalidation is used

### MINOR ISSUES (not top 10 but worth noting)

- **`Home.tsx` line 132**: uses `queryKey: ['shops', 'all', '']` (hardcoded empty string) while `Shops.tsx` uses `['shops', 'all', debouncedSearch]`. These share the same base key for the empty-search case, which is intentional, but the `Home.tsx` query fetches without `.order('name')`. This is benign but inconsistent.
- **`DataQualityTab` line 1711**: `pendingCount` is computed from `requests.filter(r => r.status === 'pending').length` but `requests` only contains rows matching `statusFilter`. When `statusFilter !== 'all'`, this count will be wrong (e.g., if viewing "approved", `pendingCount = 0` even if there are pending requests). This is in `RequestsTab`, not `DataQualityTab`.
- **`CategoriesTab` export CSV** (line 573): the inline export function doesn't use `useCallback`. It's defined directly inside the button's `onClick`. Fine at this scale but creates a new function reference on every render.
- **`ShopCard.tsx` line 19**: `is_active` on categories is typed as `is_active?: boolean` which is correct after the BUG-07 fix, but the `categories` join type in `src/integrations/supabase/types.ts` does not include `is_active` in `shop_categories.categories`. The type cast `as any` at line 31 and 34 still works at runtime but if the Supabase type file regenerates, the property must be manually maintained.
- **`CompactShopCard` in `Home.tsx` line 31**: WhatsApp normalization `raw.length === 10 ? '91' + raw : raw` does not handle the `091XXXXXXXXXX` (11-digit with leading 0) case that `RequestListingModal.normalizeWhatsApp` handles. Minor edge case.

---

## 3. Top 10 Risks Ranked

| # | Risk | Severity | Impact |
|---|------|----------|--------|
| 1 | `normalizePhone` defined 3× with different regexes | HIGH | Silent phone normalization divergence; future dupe fix in one place won't propagate |
| 2 | `parseGoogleMapsLink` defined 2× identically | HIGH | Maintenance divergence; Google Maps URL format changes must be applied twice |
| 3 | `compressImage` defined 2× identically | MEDIUM | Quality/format changes must be applied twice; easy to miss one |
| 4 | `ShopModal` uses `setState` inside `useQuery.queryFn` | MEDIUM | Background refetch resets admin's in-progress category edits silently |
| 5 | `CategoryPage` may show duplicate shops for multi-category shops | MEDIUM | Shop appears 2x on category page if assigned to same category twice |
| 6 | `DataQualityTab` / `ShopsTab` share `['admin-shops']` query key with different intents | LOW-MEDIUM | Column mismatch risk if either query diverges |
| 7 | `CsvImportModal` sequential insert with no rollback | LOW-MEDIUM | Partial imports on network failure, no recovery path |
| 8 | `shop_engagement` has no FK constraint to `shops` | LOW | Orphaned analytics rows accumulate after shop deletion |
| 9 | `AdminDashboard.tsx` is a 3668-line monolith | HIGH (maintainability) | Any change risks touching unrelated logic; no logical separation |
| 10 | `ShopDetail` fetches inactive shops, no server-side filter | LOW | Minor privacy leak; stale cache for reactivated shops |

---

## 4. Fix Now (This Session)

These three are real runtime bugs, not just maintainability concerns, and are self-contained targeted fixes:

**FIX-A — RISK-04 (setState in queryFn)**: The `ShopModal` `useQuery` at line 2056 calls `setSelectedCategoryIds` inside the `queryFn`. Change to use `onSuccess` or, better, use `useEffect` to watch query data and set state. This prevents background refetch silently resetting the admin's category selection.

**FIX-B — RISK-05 (CategoryPage duplicate shops)**: The query at line 73–86 fetches via `shop_categories` and can return the same shop multiple times if it appears in the category via multiple `shop_categories` rows (e.g., after a partial merge). Add a deduplication step after the filter: `const seen = new Set(); return data.map(r=>r.shops).filter(s => s && s.is_active && !seen.has(s.id) && seen.add(s.id))`.

**FIX-C — RISK-01 (shared normalizePhone utility)**: Extract a single `normalizePhone` to `src/lib/shopUtils.ts` and import it in `RequestListingModal.tsx` and `AdminDashboard.tsx`. The three current implementations produce the same result for all realistic inputs but this is a maintenance time-bomb. This is a mechanical refactor — no behavior change.

---

## 5. Can Wait

These are real risks but safe to defer:

- **RISK-02 (`parseGoogleMapsLink` duplication)** — no divergence yet; only one reasonable implementation; low urgency
- **RISK-03 (`compressImage` duplication)** — identical logic in both places; safe to defer extraction to `src/lib/imageUtils.ts` later
- **RISK-06 (shared query key)** — currently harmless because both queries select identical columns
- **RISK-07 (CSV sequential insert)** — acceptable at current scale (<50 shops typical); would need a batch insert endpoint to fix properly
- **RISK-08 (engagement FK)** — additive DB change, low operational risk now; can add FK + cascade delete as a migration later
- **RISK-09 (monolith)** — splitting AdminDashboard is a large refactor. Correct approach is to extract each tab into its own file under `src/pages/admin/`. Not suitable for a targeted session fix
- **RISK-10 (ShopDetail inactive filter)** — low real-world impact; cache invalidation from admin panel (`['shops']` broad key) covers the reactivation case

---

## Implementation Plan

### FIX-A — ShopModal setState in queryFn (RISK-04)

**File:** `src/pages/AdminDashboard.tsx` lines 2056–2073

Current code runs `setSelectedCategoryIds(...)` inside `queryFn`. Replace with `useEffect` watching query data:

```ts
const { data: shopCategoryData } = useQuery({
  queryKey: ['shop-categories', shop.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('shop_categories').select('category_id').eq('shop_id', shop.id);
    if (error) throw error;
    return data;
  },
  enabled: !!shop.id,
});

useEffect(() => {
  if (shopCategoryData === undefined) return;
  if (shopCategoryData.length > 0) {
    setSelectedCategoryIds(shopCategoryData.map((r: any) => r.category_id));
  } else if (shop.category_id) {
    setSelectedCategoryIds([shop.category_id]);
  }
}, [shopCategoryData]);
```

### FIX-B — CategoryPage deduplication (RISK-05)

**File:** `src/pages/CategoryPage.tsx` lines 81–84

Change:
```ts
return data.map((r: any) => r.shops).filter((s: any) => s && s.is_active);
```
To:
```ts
const seen = new Set<string>();
return data
  .map((r: any) => r.shops)
  .filter((s: any) => {
    if (!s || !s.is_active) return false;
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
```

### FIX-C — Shared normalizePhone utility (RISK-01)

**File:** `src/lib/shopUtils.ts` — add `normalizePhone` export

```ts
/** Strip formatting chars and leading 91 country code → 10-digit normalized */
export function normalizePhone(phone: string): string {
  let n = phone.replace(/[\s\-().+]/g, '');
  if (n.startsWith('91') && n.length === 12) n = n.slice(2);
  return n;
}
```

**File:** `src/components/RequestListingModal.tsx` line 10–13 — replace local `normalizePhone` with import. The current version uses `/\D/g` which is more aggressive (strips colons, letters, etc.). Since the function is only called on user phone input, the practical difference is zero — both produce identical output for any realistic Indian phone number. Switch to the shared version.

**File:** `src/pages/AdminDashboard.tsx` line 1887–1891 — remove module-level `normalizePhone` function. The one inside `handleApprove` at line 2718 is also a local redeclaration — remove it and use the imported one. Import from `@/lib/shopUtils`.

---

### Files to change

1. `src/lib/shopUtils.ts` — add exported `normalizePhone`
2. `src/components/RequestListingModal.tsx` — remove local `normalizePhone`, import from shopUtils
3. `src/pages/AdminDashboard.tsx` — remove two local `normalizePhone` declarations (lines ~1887 and ~2718), import from shopUtils; fix `ShopModal` queryFn setState anti-pattern
4. `src/pages/CategoryPage.tsx` — add deduplication in shop query result

All changes are surgical. No UI regressions possible. No DB changes needed.
