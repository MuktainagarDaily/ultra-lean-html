
## Status Assessment

After reading the codebase, here is the status of all items:

Already resolved (skip):
- RISK-02 normalizePhone: both files import from `@/lib/shopUtils`
- RISK-03 parseGoogleMapsLink: both files import from `@/lib/mapsUtils`
- RISK-04 compressImage: both files import from `@/lib/imageUtils`
- RISK-05 CSV sequential insert: user explicitly deferred
- RISK-06 DataQualityTab query key: already uses `['admin-shops-quality']`
- RISK-07 FK constraint: FK already exists on schema with CASCADE
- RISK-08 CategoryPage deduplication: `seen` Set already deduplicates (lines 81–89)
- RISK-09 ShopModal setState anti-pattern: already uses `useEffect` with `shopCategoryData`

Needs implementation (3 items):
1. **RISK-01** — AdminDashboard.tsx is still 3,605 lines (monolith)
2. **RISK-10** — ShopDetail fetches inactive shops (no `is_active` filter at DB level)
3. **MINOR** — `pendingCount` is wrong when `statusFilter !== 'all'`
4. **MINOR** — `CompactShopCard` WhatsApp misses `091XXXXXXXXXX` (11-digit with leading 0) edge case

---

## Plan

### RISK-01 — Split AdminDashboard monolith

Extract every tab and modal into its own file under `src/components/admin/`. The root `AdminDashboard.tsx` becomes a thin shell (~80 lines) that imports and composes them.

```text
src/components/admin/
  ShopsTab.tsx
  CategoriesTab.tsx
  AnalyticsTab.tsx
  RequestsTab.tsx
  DataQualityTab.tsx
  ShopModal.tsx
  CategoryModal.tsx
  CategoryMergeModal.tsx
  CsvImportModal.tsx
  adminHelpers.ts        ← extractStoragePath, normalizeWhatsApp, isValidPhone, Field, StatCard, TabButton
```

Shared inline helpers (`extractStoragePath`, `normalizeWhatsApp`, `isValidPhone`, `Field`, `StatCard`, `TabButton`) move to `adminHelpers.ts`. All existing imports of `normalizePhone`, `compressImage`, `parseGoogleMapsLink` remain from their shared lib files. No logic changes — purely mechanical extraction.

### RISK-10 — ShopDetail: filter inactive shops at DB level

In `src/pages/ShopDetail.tsx`, add `.eq('is_active', true)` to the Supabase query. This means the query returns null/error for inactive shops, which already renders the "Shop not found" screen (line 73). No separate "unavailable" screen needed — the existing guard covers it. The stale-cache concern is also resolved because an inactive shop will simply miss from the query result.

### MINOR — pendingCount fix in RequestsTab

`pendingCount` at line 2654 counts `requests.filter(r => r.status === 'pending').length`. Since `requests` is already filtered by `statusFilter`, this count is 0 whenever the admin is viewing "approved" or "rejected". Fix: add a separate `useQuery` for the count, or simply query `['admin-requests', 'pending']` for the badge count independently of the display filter. Simplest fix: use a dedicated count query:

```ts
const { data: pendingCountData } = useQuery({
  queryKey: ['admin-requests-pending-count'],
  queryFn: async () => {
    const { count } = await supabase
      .from('shop_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    return count ?? 0;
  },
});
```

Replace `pendingCount` usage with `pendingCountData ?? 0`.

### MINOR — CompactShopCard WhatsApp 091 edge case

In `src/pages/Home.tsx` line 32, normalize the WhatsApp number using the same logic as `RequestListingModal.normalizeWhatsApp`:

```ts
// Before:
return raw.length === 10 ? `91${raw}` : raw;

// After:
if (raw.length === 10) return `91${raw}`;
if (raw.length === 11 && raw.startsWith('0')) return `91${raw.slice(1)}`;
if (raw.startsWith('91') && raw.length === 12) return raw;
return raw;
```

---

## File Changes Summary

| File | Change |
|---|---|
| `src/pages/AdminDashboard.tsx` | Reduce to ~80-line shell; all tabs/modals extracted |
| `src/components/admin/ShopsTab.tsx` | New — extracted from AdminDashboard |
| `src/components/admin/CategoriesTab.tsx` | New — extracted |
| `src/components/admin/AnalyticsTab.tsx` | New — extracted |
| `src/components/admin/RequestsTab.tsx` | New — extracted + pendingCount fix |
| `src/components/admin/DataQualityTab.tsx` | New — extracted |
| `src/components/admin/ShopModal.tsx` | New — extracted |
| `src/components/admin/CategoryModal.tsx` | New — extracted |
| `src/components/admin/CategoryMergeModal.tsx` | New — extracted |
| `src/components/admin/CsvImportModal.tsx` | New — extracted |
| `src/components/admin/adminHelpers.ts` | New — shared inline helpers |
| `src/pages/ShopDetail.tsx` | Add `.eq('is_active', true)` to query |
| `src/pages/Home.tsx` | Fix CompactShopCard WhatsApp 091 edge case |
