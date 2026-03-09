# QA Report — Muktainagar Daily

## 1. Summary

**Overall status:** Mostly functional with several medium and high-severity bugs that need attention before wide deployment.make sure nothing break in site itself.

**Major risks:**

- Request approval phone duplicate check queries by raw phone value, not normalized — may silently fail to detect duplicates
- Public listing form requires GPS/location which blocks legitimate submissions without GPS-capable devices or Maps links
- Category merge `shopCount` shown in dialog is stale (comes from `admin-categories` cache, not freshly fetched), meaning it can mislead admins
- `ShopCard` does not filter out inactive categories (it reads `is_active` via type cast, but the `Shop` interface does not include it on the nested type — this works at runtime but is fragile)
- Area normalize function in `RequestsTab.handleApprove` uses the old ASCII-only `\b\w` regex, inconsistent with the fixed `dqNormalizeAreaValue` in Data Quality
- CSV import does not invalidate public shop queries after import finishes
- Storage scan hard-caps at 1,000 files — will silently miss orphans if bucket has more than 1,000 files

**Release readiness:** Suitable for soft-launch with awareness of the bugs below. None are data-corrupting at current scale, but a few are user-visible UX issues.

---

## 2. Passed

- Homepage loads, hero renders, trust strip, stat pills, category grid, Recently Added section all function correctly
- Category grid sorts by shop count descending — correct
- Search bar navigates to `/shops?search=...` — correct
- "View All Shops" CTA navigates and shows count — correct
- "List Your Shop — Free" opens `RequestListingModal` — correct
- Public Shops page: debounced search, text search by name/area/address, numeric search for phone — all implemented correctly
- Filter bottom sheet: availability, area, category, verified toggles; sheet preview count; Apply/Clear All — correct
- Filter pills with inline X remove button — correct
- "?filter=verified" URL param pre-activates verified-only filter — correct
- Auto-refresh every 60 seconds on Shops and CategoryPage — correct
- ShopCard: verified badge, open/closed badge, image lazy load with fallback, call/WhatsApp/Maps buttons — correct
- ShopDetail: inactive guard (shows 🔒 screen), skeleton loading, share button (native + clipboard fallback) — correct
- ShopDetail: engagement tracking (call/WhatsApp) is fire-and-forget, non-blocking — correct
- WhatsApp normalization (10-digit → 91 prefix) — correct in ShopDetail
- Admin auth: ProtectedRoute guards /admin, unauthenticated → /admin/login — correct
- Admin login: credential validation error messaging — correct
- Admin logout: sign out → navigate to /admin/login — correct
- ShopsTab: search by name/area/address/phone, category filter dropdown, export CSV, import CSV button — correct
- Admin shop active/inactive toggle and verified toggle — correct, with cache invalidation
- Admin shop safe-delete with AlertDialog + shop name — correct
- Admin shop form: name/phone required, area/address required, WhatsApp optional, lat/lng range validation — correct
- Duplicate phone detection in ShopModal — blocks save and shows dupe dialog with shop info — correct
- Image upload: compress to WebP, upload to storage, store URL — correct
- Image replacement: old storage file deleted when new image uploaded on edit — correct
- Category CRUD: add/edit/delete/toggle — correct
- Category delete safe dialog: shows affected shop names in scrollable list — correct
- Category merge: DELETE + INSERT strategy (bypasses missing RLS UPDATE policy) — correct after recent fix
- Cache invalidation after merge includes `['shops']` broad key for public pages — correct after recent fix
- Analytics: date range filter (7d/30d/all), sort by total/calls/WhatsApp, top categories — correct
- Analytics empty state — correct
- Request listing flow: form, validation, image upload, location capture, submit to `shop_requests` — correct
- Requests tab: pending/approved/rejected filter, view detail modal, reject, delete with storage cleanup — correct
- Data Quality: area consistency table with counts, rename flow, similar area detection, Merge button — correct after recent fixes
- Duplicate detector: phone normalization grouping, name+area heuristic grouping — correct
- Storage Audit section: scan, find orphans, select, bulk delete with confirm dialog — correct
- CSV import: upload, preview, blocking errors, warnings, duplicate detection against DB and within CSV, quoted comma parsing, category mapping, result summary — correct
- `isShopOpen`: overnight hour support (e.g. 22:00–06:00) — correct
- Mobile layout: sticky headers, scrollable filter pills, bottom padding so FAB doesn't overlap — correct
- Empty states for all major scenarios (no search results, no category shops, no verified shops, etc.) — all present

---

## 3. Failed / Bugs Found

### BUG-01 — Request Approval: Phone Duplicate Check Queries Raw Phone, Not Normalized

**Area:** RequestsTab → `handleApprove`  
**File:** `src/pages/AdminDashboard.tsx` line 2662–2670

**Reproduction:**

1. A shop exists in DB with phone `+91 9284555571`
2. A request comes in with phone `9284555571`
3. Admin clicks Approve
4. Duplicate check queries `shops.eq('phone', normPhone)` where normPhone = `9284555571`
5. The existing shop's stored phone is `+91 9284555571` — so the equality match fails
6. Approval proceeds and a duplicate shop is created

**Expected:** Duplicate is detected and approval blocked with a toast error  
**Actual:** Duplicate is silently missed; a second shop with same number is created

**Why:** `normalizePhone` strips `+91` to get `9284555571`, but the DB `.eq('phone', normPhone)` does a literal equality match — it does not run `normalizePhone` on the stored phone values. The stored phone may still have `+91`  prefix. This will miss any shop whose phone was saved without normalization.

**Severity: HIGH** — creates duplicate shops, data integrity issue

---

### BUG-02 — RequestListingModal: Location Is Required (Blocks Legitimate Submissions)

**Area:** Public listing form  
**File:** `src/components/RequestListingModal.tsx` line 157–159

**Reproduction:**

1. Public user opens "List Your Shop" form
2. Fills all fields correctly
3. Does NOT provide a location (doesn't have GPS, or doesn't know how to use Maps link)
4. Tries to submit — blocked with "Shop location is required"

**Expected:** Location should be optional for a public submission form — admin can add it later during approval  
**Actual:** Location is a hard required field, blocking form submission entirely

**Severity: HIGH** — kills submission conversion rate; many users, especially non-technical, will be unable to submit

---

### BUG-03 — Category Merge Modal: `shopCount` in Description Is Stale

**Area:** Category merge dialog  
**File:** `src/pages/AdminDashboard.tsx` line 814

**Reproduction:**

1. Category "Electronics" has 3 shops
2. Admin edits one shop to remove Electronics category
3. Now "Electronics" has 2 shops
4. Admin clicks merge on Electronics
5. The dialog says "Reassign all 3 shops" (stale count from query cache)
6. Actual merge proceeds correctly (fetches fresh from DB), but the number shown is wrong

**Expected:** Dialog should reflect the current count  
**Actual:** Shows cached count from `admin-categories` query, which may be up to 30s stale

**Severity: MEDIUM** — confusing but not data-corrupting (actual operation uses fresh DB fetch)

---

### BUG-04 — Area Normalize in RequestsTab Uses Old Regex (Inconsistent with Data Quality)

**Area:** Admin → Requests → handleApprove  
**File:** `src/pages/AdminDashboard.tsx` line 2686

**Code:**

```ts
const normalizeArea = (s: string) => s.trim().replace(/\b\w/g, (c) => c.toUpperCase());
```

**Problem:** Uses `\b\w` which is ASCII-only and fails to title-case English words that follow Devanagari characters (e.g. `"परिवर्तन chowk"` → keeps `chowk` lowercase). The same bug was fixed in `dqNormalizeAreaValue` using `/(^|[\s,])([a-z])/g`. The fix was applied to Data Quality but not here.

**Same inconsistency exists in:** `CsvImportModal.normalizeArea` (line 3257) and `ShopModal.executeSave` internal `normalizeArea` (line 2087) — all three use the old regex.

**Severity: LOW** — visual inconsistency in area names for bilingual areas; no data loss

---

### BUG-05 — CSV Import Does Not Invalidate Public Shop Queries

**Area:** CsvImportModal → `onDone` callback  
**File:** `src/pages/AdminDashboard.tsx` line 155–160

**Code:**

```ts
onDone={() => {
  setShowImport(false);
  qc.invalidateQueries({ queryKey: ['admin-shops'] });
  qc.invalidateQueries({ queryKey: ['admin-stats'] });
}}
```

**Missing:** `qc.invalidateQueries({ queryKey: ['shops'] })` — without this, the public Shops page and category pages will show stale data after a CSV import until the 30s `staleTime` expires.

**Severity: MEDIUM** — newly imported shops don't appear publicly for up to 30 seconds after import

---

### BUG-06 — Storage Scan Hard-Capped at 1,000 Files

**Area:** StorageAuditSection → `runScan`  
**File:** `src/pages/AdminDashboard.tsx` line 1576–1578

**Code:**

```ts
const { data: files } = await supabase.storage.from('shop-images').list('', { limit: 1000, offset: 0 });
```

**Problem:** Supabase Storage list() has a default page size and this uses `limit: 1000` with no pagination loop. If the bucket ever exceeds 1,000 files, orphans beyond the first 1,000 will be silently missed by the scan.

**Severity: LOW** — at current scale (small directory), highly unlikely to hit. Future risk only.

---

### BUG-07 — `ShopCard` Interface Missing `is_active` on Category — Fragile Runtime Cast

**Area:** ShopCard  
**File:** `src/components/ShopCard.tsx` line 19

**Code:**

```ts
shop_categories?: { categories: { name: string; icon: string } | null }[];
```

`is_active` is not part of the type definition, but line 31 does:

```ts
if (sc.categories && (sc.categories as any).is_active !== false) allCats.push(sc.categories);
```

This works at runtime but is technically type-unsafe. More importantly, if the query in `Shops.tsx` or `CategoryPage.tsx` ever changes and stops selecting `is_active` on categories, this silently breaks — inactive categories start appearing on cards with no TS error.

**Severity: LOW** — works now, fragile for future maintenance

---

### BUG-08 — CompactShopCard (Home) Has No Engagement Tracking on Call/WhatsApp

**Area:** Home page → CompactShopCard  
**File:** `src/pages/Home.tsx` lines 80–100

**Problem:** The compact quick-action buttons (📞 Call, 💬 WA) in the "Recently Added" horizontal scroll section are plain `<a>` tags with no `onClick` engagement logging. ShopDetail logs call/WhatsApp engagement, but taps from the Home page cards are not tracked at all.

**Severity: LOW** — analytics undercounting, not a functional bug

---

### BUG-09 — RequestsTab: Approved Requests Do Not Invalidate Public Queries

**Area:** Admin → Requests → `handleApprove`  
**File:** `src/pages/AdminDashboard.tsx` line 2727–2729

**Code:**

```ts
qc.invalidateQueries({ queryKey: ['admin-requests'] });
qc.invalidateQueries({ queryKey: ['admin-stats'] });
onShopCreated(); // invalidates ['admin-shops'] + ['admin-stats']
```

**Missing:** `qc.invalidateQueries({ queryKey: ['shops'] })` — newly approved shops don't appear on public pages until staleTime expires.

**Severity: MEDIUM** — same class as BUG-05

---

### BUG-10 — `closingTime <= openingTime` Time Validation Uses String Comparison

**Area:** RequestListingModal validation  
**File:** `src/components/RequestListingModal.tsx` line 160

**Code:**

```ts
if (form.opening_time && form.closing_time && form.closing_time <= form.opening_time)
```

This works for most cases because HH:MM strings sort lexicographically correctly (09:00 < 21:00). However, it **incorrectly blocks overnight shops** (e.g., 22:00–06:00 would be blocked because `"06:00" <= "22:00"`). The admin ShopModal has no such time order validation, so the public form is stricter than the admin form — an inconsistency.

**Severity: LOW** — prevents valid overnight-hours submissions from the public form

---

## 4. Risky / Uncertain


| #   | Area                                             | What Is Uncertain                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Session persistence after token expiry**       | The admin session is set to auto-refresh. If the admin keeps the tab open for days, the token should refresh silently. Not verified end-to-end — could result in silent auth failures for long-running admin sessions.                                                                                                                                                                                   |
| R2  | **Image upload error handling**                  | If `canvas.toBlob()` returns `null` (can happen on certain browsers/formats), the `compressImage()` function calls `resolve(null!)` — the `!` non-null assertion would pass `null` to the upload and cause a runtime error. Both `ShopModal` and `RequestListingModal` have this pattern.                                                                                                                |
| R3  | **WhatsApp normalization edge case**             | In `ShopCard.tsx` line 46–52, WhatsApp normalization only handles the 10-digit case (adds `91`). If `shop.whatsapp` stored has `+91` prefix (13 chars with +), the digits-stripped value is 12, and it passes through as-is — this actually works correctly. However if stored as `091XXXXXXXXXX` (11 digits after stripping +), the logic does nothing and `wa.me/091...` would be invalid. Not tested. |
| R4  | **Category page for inactive/disabled category** | `CategoryPage` fetches from `shop_categories` joined to shops. It correctly filters `s.is_active` for shops. However, it does NOT check if the category itself is `is_active`. A direct URL visit to `/category/<disabled-category-id>` will load and show a page with the category name/icon — just with 0 shops. This is a minor info leak but not harmful.                                            |
| R5  | **Mobile browser GPS + HTTPS requirement**       | `navigator.geolocation` requires HTTPS in modern browsers. The production URL uses HTTPS so this should work. The dev preview might not. Not tested on a real mobile device.                                                                                                                                                                                                                             |
| R6  | **Concurrent admin edits**                       | If two admin tabs are open simultaneously, the last write wins. No optimistic locking, no conflict detection. Low risk for a single-admin app.                                                                                                                                                                                                                                                           |
| R7  | **Analytics query with > 1000 engagement rows**  | `shop_engagement` select has no `.limit()` but Supabase defaults to 1000 rows per query. If total engagement events exceed 1000, analytics will silently undercount.                                                                                                                                                                                                                                     |
| R8  | **CSV import: sequential insert loop**           | Import does one insert per row in a `for` loop. For large CSVs (100+ rows) this will be slow and could time out. No progress indicator during import — user sees just "Importing…" spinner.                                                                                                                                                                                                              |


---

## 5. Highest Priority Fixes


| Priority | Bug                                                                                 | Impact                                                      |
| -------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1        | **BUG-01** — Request approval phone dupe check uses raw equality                    | Allows duplicate shops to be created silently               |
| 2        | **BUG-02** — Public listing form requires location                                  | Blocks legitimate submissions, hurts conversion rate        |
| 3        | **BUG-05 + BUG-09** — CSV import + request approval don't invalidate public queries | Newly created shops invisible to public for up to 30s       |
| 4        | **R7** — Analytics query capped at 1000 rows                                        | Silently undercounts engagement at scale                    |
| 5        | **BUG-03** — Stale shopCount in merge dialog                                        | Admin confusion; no data loss                               |
| 6        | **BUG-04** — Inconsistent area normalizeArea regex                                  | Bilingual area names not title-cased correctly              |
| 7        | **BUG-10** — Overnight hours blocked in public form                                 | Valid overnight business hours rejected                     |
| 8        | **R2** — canvas.toBlob null crash                                                   | Potential runtime crash on image upload in certain browsers |


---

## 6. Suggested Next Action

**Fix blocking bugs first** (BUG-01, BUG-02, BUG-05+09) before any broader rollout. These directly affect real users.

After that, **address the analytics row limit (R7)** before the engagement table grows large — it's a silent issue that's easy to miss.

The remaining items are low risk and can be addressed in a follow-up pass. The app is functionally solid for a small-scale local directory launch.