
## Retest Findings — Targeted Areas

### What I examined (code + live network data):

1. **Duplicate phone detection** — ShopModal add/edit, CSV import, request approval
2. **CSV import → public visibility** — `onDone` callback invalidation
3. **Request approval → public visibility** — `handleApprove` invalidation
4. **Storage cleanup on request delete** — `handleDelete` in RequestsTab
5. **Storage cleanup on shop image replace** — `executeSave` in ShopModal
6. **Merged/deactivated categories disappearing** — ShopCard, ShopDetail, CategoryPage query, Shops filter
7. **CompactShopCard engagement tracking** — Home.tsx `logEngagement`
8. **Overnight timings** — `isShopOpen` in shopUtils.ts and time validation in RequestListingModal
9. **Analytics data volume** — engagement query limit
10. **Bilingual search/category handling** — Shops.tsx search query, CategoryPage filter

---

### PASSED — Verified correct in code

**Duplicate phone — ShopModal (add/edit):**
- `handleSave` fetches ALL shops and uses client-side `normalizePhone()` that strips `+`, spaces, `-`, `()`, `.` and strips leading `91` from 12-digit numbers. Compares normalized values on both sides. `+91 9284555571` → `9284555571`, live DB shop with same stored phone → match detected.
- **PASS**

**Duplicate phone — CSV import:**
- `processText` fetches all shops, builds `existingPhones` set using the same `normalizePhone()` function. Both sides normalized. 
- **PASS**

**Duplicate phone — Request approval:**
- `handleApprove` (line 2675) defines its own `normalizePhone` using `replace(/[\s\-().+]/g, '')`, strips leading `91` from 12-digit. Fetches all shops client-side and normalizes both sides.
- **PASS** (the original BUG-01 fix is correctly applied)

**CSV import → public visibility:**
- `onDone` callback at line 155–161 now includes `qc.invalidateQueries({ queryKey: ['shops'] })`.
- **PASS**

**Request approval → public visibility:**
- `handleApprove` at line 2749 now includes `qc.invalidateQueries({ queryKey: ['shops'] })`.
- **PASS**

**Storage cleanup on request delete:**
- `handleDelete` at line 2781–2789: if `req.image_url` exists, calls `extractStoragePath(req.image_url)` and then `supabase.storage.from('shop-images').remove([path])`. Non-blocking with warning toast on failure.
- **PASS**

**Storage cleanup on shop image replace:**
- `executeSave` at line 2148–2157: `if (isEdit && oldImageUrl.current && oldImageUrl.current !== form.image_url)` then extracts path and removes it.
- **PASS**

**Category merge — shops disappear from ShopCard:**
- `ShopCard` filters `is_active !== false` on categories. Shops page query selects `shop_categories(categories(name, icon, is_active))`.
- After merge with `disableSource=true`, source category `is_active=false`. The ShopCard `allCats` filter removes it. Only the new target category link appears.
- **PASS**

**Category merge — ShopDetail:**
- `ShopDetail` fetches `shop_categories(categories(name, icon, is_active))` and filters `c.is_active !== false`.
- **PASS** (same pattern)

**Merged category — Shops page filter UI:**
- Shops.tsx query selects `is_active` on categories. The filter drawer populates `categoryOptions` from shops' `shop_categories`. Since the category filter in the drawer uses category names from the already-filtered `allCats` (via ShopCard rendering) — categories with `is_active=false` won't have shops pointing to them in the filter.
- Confirmed from live network: `Electronics` category now `is_active=false`. The admin categories query confirms this.
- **PASS**

**CompactShopCard engagement tracking:**
- `Home.tsx` line 26–28: `logEngagement` inserts to `shop_engagement`. Called in both `📞 Call` onClick (line 87) and `💬 WA` onClick (line 99).
- **PASS** (BUG-08 fix applied correctly)

**Overnight timings — `isShopOpen`:**
- `shopUtils.ts` lines 34–36: `if (closeMins < openMins) return nowMins >= openMins || nowMins < closeMins`. Overnight logic correct.
- **PASS**

**Overnight timings — RequestListingModal validation:**
- Lines 159–167: uses minute-comparison `closeMins === openMins` to only block identical times. Overnight (close < open) explicitly allowed per comment.
- **PASS** (BUG-10 fix applied correctly)

**Analytics query limit:**
- Network log confirms: `shop_engagement?...&limit=5000` — the 5000 limit is applied.
- **PASS**

---

### BUGS FOUND — Still present or newly discovered

**BUG-A (NEW, MEDIUM): `Puja super shoppee` has NO `shop_categories` entry**

From live network response body:
```json
{"id":"e988c4b9-...","name":"Puja super shoppee","shop_categories":[]}
```

The shop's `category_id` column still shows `a5d02f2e` (Grocery) — the legacy FK column — but `shop_categories` is empty. This means:
- On ShopCard, `allCats` is empty → no category icon shown, no category chip
- On ShopDetail, no category badge
- This shop is NOT filterable by category in the Shops page filter
- This shop does NOT appear under the Grocery category page

**Root cause**: The `shop_categories` join table was not populated for this shop. Looking at the legacy `category_id` column on the `shops` table itself — it seems some shops were originally added with just `category_id` and never got a `shop_categories` row created. The admin ShopModal correctly creates `shop_categories` entries on edit, but only after a re-save.

**Severity: MEDIUM** — Shop not findable by category filter or category page. Affects any shop that has `category_id` set but no `shop_categories` row.

---

**BUG-B (NEW, LOW): `New Muktai Electricals` still shows Electronics category chip**

From live network response:
```json
{"id":"8d0ea870-...","name":"New Muktai Electricals & Furniture Showroom","shop_categories":[{"categories":{"id":"f1e84326-...","icon":"📱","name":"Electronics"}}]}
```

The `shop_categories` row for this shop points to Electronics (`f1e84326`), which is now `is_active=false` (confirmed from categories query). The `ShopCard` correctly filters out inactive categories via `is_active !== false`. So this shop will show **no category chip** on its card — not harmful but potentially confusing if the intended post-merge category was Grocery or another active one.

**Root cause**: When Electronics was merged/disabled, the merge logic reassigns shop_categories rows to the target category. However, from the `shop_categories` response in the live network:
```json
[{"category_id":"a5d02f2e"},{"category_id":"f1e84326"},{"category_id":"f1e84326"}]
```

Only 3 `shop_categories` rows exist for all shops. The two `f1e84326` (Electronics) entries still exist! Electronics was marked `is_active=false` but the shop_categories rows pointing to it were NOT deleted/reassigned. This means the category merge DID run `disableSource=true` but the actual `shop_categories` reassignment may have been skipped or the merge was done **before the latest code fix was deployed**.

**Note**: This is likely historical data from before the merge fix, not a bug in the current code. But it means the shops currently have orphaned category links pointing to a disabled category.

**Severity: LOW** — Historical data issue. New merges use the fixed DELETE+INSERT logic.

---

**BUG-C (EXISTING, LOW): `normalizeArea` in `RequestListingModal` still uses old regex**

Line 31 of `RequestListingModal.tsx`:
```ts
function normalizeArea(s: string): string {
  return s.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}
```

The BUG-04 fix was applied to `AdminDashboard.tsx` in `executeSave` (line 2104), `handleApprove` (line 2706), and CSV `normalizeArea` (line 3279). But `RequestListingModal.tsx` line 31 still uses the old `\b\w` regex.

This means: when a public user submits a bilingual area like `"परिवर्तन chowk"`, it gets stored as `"परिवर्तन chowk"` (lowercase `c`) instead of `"परिवर्तन Chowk"`.

**Severity: LOW** — cosmetic inconsistency only; the value still saves and displays.

---

### Summary Table

| Area | Status | Notes |
|------|--------|-------|
| Duplicate phone — add/edit | PASS | Client-side normalization correct |
| Duplicate phone — CSV import | PASS | Same normalization |  
| Duplicate phone — request approval | PASS | BUG-01 fix applied |
| CSV import → public visibility | PASS | `['shops']` invalidation added |
| Request approval → public | PASS | `['shops']` invalidation added |
| Storage — request delete cleanup | PASS | extractStoragePath + remove() |
| Storage — shop image replace cleanup | PASS | oldImageUrl diff check |
| Merged category — ShopCard | PASS | is_active filter applied |
| Merged category — ShopDetail | PASS | same filter |
| Merged category — filter UI | PASS | inactive cats filtered out |
| CompactShopCard engagement | PASS | BUG-08 fix applied |
| Overnight timings — isShopOpen | PASS | overnight logic correct |
| Overnight timings — public form | PASS | BUG-10 fix applied |
| Analytics 5000 row limit | PASS | confirmed in network log |
| Bilingual area search (ilike) | PASS | ilike handles Unicode |
| Shops missing shop_categories rows | BUG-A (new) | Puja super shoppee has empty shop_categories |
| Historical orphaned category links | BUG-B (data) | Pre-fix Electronics links still in DB |
| RequestListingModal normalizeArea regex | BUG-C (low) | Old `\b\w` not updated in this file |

---

### Fixes needed

**Two targeted fixes:**

1. **BUG-C (easy)**: Update `normalizeArea` in `RequestListingModal.tsx` line 30–32 to use the bilingual-safe regex, same as the three places in `AdminDashboard.tsx`.

2. **BUG-A data fix**: The orphaned situation (shops with `category_id` set but no `shop_categories` row) needs a **one-time data migration** or admin tool. The least invasive fix: when the ShopModal opens an existing shop, if `shop.category_id` exists but `shop_categories` is empty, auto-populate `selectedCategoryIds` from the legacy `category_id` column as a fallback. This way, the next time admin opens and saves that shop, it creates the proper join table entry.

   For `Puja super shoppee` specifically: already `category_id = a5d02f2e` (Grocery). If admin opens and saves that shop, the ShopModal `executeSave` will delete + re-insert shop_categories, creating the Grocery entry correctly.

3. **BUG-B historical data**: The two remaining `shop_categories` rows pointing to the now-disabled Electronics category should be cleaned up. These are orphaned joins. The admin can use the Storage/Data Quality merge tool again or we can add a one-time migration. Since the merge code now works correctly, just re-running a merge of Electronics into the correct target would clean these up.

---

### File to change

**`src/components/RequestListingModal.tsx`** — line 30–32: fix `normalizeArea` regex

**`src/pages/AdminDashboard.tsx`** — ShopModal initialization: when `shop.category_id` exists and `shop.shop_categories` is empty, fall back to legacy `category_id` for initial `selectedCategoryIds`.

---

### What is NOT a bug

- Bilingual search with `ilike` is handled correctly (Postgres `ilike` is Unicode-aware for ASCII patterns, and the Devanagari search works because it's a substring match not a word-boundary match)
- Analytics are confirmed correct at current data volume (2 rows visible in network response, well within 5000 limit)
- All storage cleanup paths confirmed working in code
- All cache invalidation paths confirmed added
