# V2_DOC_CHANGES.md — V2 Changes Log

> Generated: March 2026  
> Last updated: 9 March 2026  
> Tracks all changes made during V2 phases.

---

## V2 Phase 1 — Area Filter · Verified Badge · Category Counts

> Scope: Public-facing discoverability + admin operational clarity

### 1. Area Filter — Shops Page + Category Page

- Filter bottom sheet (vaul Drawer) replaces flat horizontal chip row
- Three-way availability toggle: All / Open Now / Closed Now
- Multi-select area checklist (2-column grid, checkboxes)
- Multi-select category pills (Shops page only)
- Active filter pills in header bar with individual × removal
- Filter button shows active count badge
- "Show N Shops" CTA in sheet updates in real time as filters change
- All filters stack with existing search

### 2. Verified Badge on ShopCard

- `ShieldCheck` + "Verified" pill rendered when `is_verified = true`
- Style matches ShopDetail verified badge (primary color tint)
- Hidden for unverified shops; no layout impact

### 3. Category Usage Counts in Admin

- `CategoriesTab` query fetches `shop_categories` in parallel with categories
- `countMap` built in JS (O(n)), each category extended with `shopCount`
- "Shops" column added to admin categories table (hidden on mobile)
- 0-count shows muted badge; active count shows primary-tinted pill

### 4. Mobile Responsiveness Improvements

- **Home page**: responsive hero text, search bar, stat pills, category grid, trust strip, FAB
- **ShopCard**: image height, verified badge size, category chip overflow, 44px touch targets
- **ShopDetail**: action buttons 52px min-height, truncated phone number display

---

## V2 Phase 2 — Better Analytics

> Scope: Date-filtered analytics, top shops by engagement type, top categories by engagement

### 1. Analytics Date Range Filter

**What changed (`src/pages/AdminDashboard.tsx` — `AnalyticsTab`):**
- `DateRange` type: `'7d' | '30d' | 'all'` — default is `'30d'`
- Segmented pill selector renders inline next to the section title
- ISO cutoff computed via `useMemo` from selected range
- Query key includes `dateRange` so React Query re-fetches on change
- Supabase query uses `.gte('created_at', cutoff)` when range is not "all time"
- All three sections (summary cards, top shops, top categories) share the same filtered `rows` array

### 2. Top Shops by Engagement Type

**What changed:**
- `ShopSort` type: `'total' | 'call' | 'whatsapp'`
- "Top Shops" section has a 3-way toggle (Total / 📞 Calls / 💬 WhatsApp)
- `sortedShops` derived via `useMemo` — sorted descending by selected dimension, zero-count rows excluded
- On mobile: Calls and WA columns hidden (`hidden sm:table-cell`); active sort column always visible
- Highlighted column color matches dimension (primary for total/calls, `#25D366` for WhatsApp)
- Empty state shows calm message when no data for selected period

### 3. Top Categories by Engagement

**What changed:**
- `aggregatedCategories` built from `rows` by walking `shops.shop_categories` join
- Each category accumulates `total`, `call`, `whatsapp` counts from all linked shops
- Sorted descending by total; displayed in same table pattern as top shops
- Category icon rendered inline in the name column
- Calls + WA columns hidden on mobile; Total always visible
- Empty state consistent with top shops empty state
- Multi-category shops are counted for each of their categories (correct — engagement happened for that shop, which belongs to multiple categories)

---

## Kept Unchanged (Verified Phase 1 + Phase 2)

| Feature | Status |
|---|---|
| Phone normalization + WhatsApp wa.me links | ✅ unchanged |
| Duplicate phone detection dialog | ✅ unchanged |
| Inactive shop 🔒 guard in ShopDetail | ✅ unchanged |
| Filter bottom sheet (area, availability, category) | ✅ unchanged |
| Auto-refresh every 60s | ✅ unchanged |
| Category delete safety dialog with linked shop names | ✅ unchanged |
| Admin search: name, area, phone, address | ✅ unchanged |
| Public search: name, area, address + numeric phone | ✅ unchanged |
| Engagement logging (call/whatsapp) in ShopDetail | ✅ unchanged |
| Hero gradient, trust strip, Marathi placeholder, FAB | ✅ unchanged |
| Admin shops/categories tabs | ✅ unchanged |

---

## V2 Phase 3 — CSV Bulk Import

> Scope: Safe bulk shop import for admin — parse, validate, preview, then commit

### 1. CSV Import Workflow

- "Import CSV" button added to Shops tab header (next to "Add Shop")
- `CsvImportModal` component added at bottom of `AdminDashboard.tsx` (same pattern as `ShopModal`)
- Three-step flow: **Upload → Preview → Result**
- No auto-import on file selection — always requires explicit confirmation

### 2. CSV Parsing

- Native `parseCsvLine` + `parseCsv` functions handle quoted fields with embedded commas correctly
- Columns read (case-insensitive, trimmed): `name, phone, whatsapp, address, area, category, opening_time, closing_time, latitude, longitude, is_active, is_verified`
- Unknown columns ignored gracefully; missing optional columns default safely

### 3. Validation Rules

Per-row validation mirrors existing `ShopModal.validate()`:

- `name` empty → ❌ blocking error
- `phone` missing or < 10 digits → ❌ blocking error
- `area` AND `address` both empty → ❌ blocking error (refinement from original plan)
- `latitude` provided but out of range → ❌ blocking error (refinement from original plan)
- `longitude` provided but out of range → ❌ blocking error (refinement from original plan)
- `whatsapp` present but invalid → 🟡 warning (non-blocking)
- `category` text unmatched → 🟡 warning (imported without category)

### 4. Duplicate Detection

Two-pass duplicate detection:
1. **Against database**: fetches all existing `shops.phone`, normalises via `normalizePhone()`, flags any match as 🔁 Duplicate
2. **Within CSV**: tracks normalised phones seen during the same parse pass; second occurrence flagged as 🔁 Duplicate

Duplicate rows are skipped by default. No override option in this phase (safe default).

### 5. Category Mapping

- Fetches all categories at modal open
- Builds `Map<lowerCaseName, id>` for O(1) lookup
- Case-insensitive exact match; unmatched shows warning, shop imported without category
- One category field per row (multi-category support deferred to next phase for safety)

### 6. Import Execution

- Reuses `normalizeWhatsApp()` and `normalizeArea()` patterns from `ShopModal`
- Inserts shop via `supabase.from('shops').insert(...)`, then `shop_categories` row if category resolved
- Collects per-row success/fail counts

### 7. Result Summary

Final step shows five distinct counters:
- Imported successfully
- Imported with warnings
- Skipped — duplicate phone
- Skipped — validation errors
- Failed (database error)

### 8. Template Download

- "Download Template CSV" button generates a Blob with header row + one example row
- Filename: `muktainagar_shops_template.csv`

---

## Kept Unchanged (Phase 1 + 2 + 3)

| Feature | Status |
|---|---|
| Phone normalization + WhatsApp wa.me links | ✅ unchanged |
| Duplicate phone detection dialog (ShopModal) | ✅ unchanged |
| Inactive shop 🔒 guard in ShopDetail | ✅ unchanged |
| Filter bottom sheet (area, availability, category) | ✅ unchanged |
| Auto-refresh every 60s | ✅ unchanged |
| Category delete safety dialog with linked shop names | ✅ unchanged |
| Admin search: name, area, phone, address | ✅ unchanged |
| Analytics date range filter + top shops + top categories | ✅ unchanged |

---

## V2 Phase 4 — Public Shop Submission + Admin Review Queue

> Scope: Safe public listing request flow with admin moderation before any shop goes live.

### 1. Data Model — `shop_requests` Table

New table added via migration:

- `id`, `name`, `phone`, `whatsapp`, `address`, `area`, `category_text`
- `opening_time`, `closing_time`, `image_url`, `submitter_name`
- `status` — `pending` | `approved` | `rejected` (CHECK constraint)
- `admin_notes`, `created_at`, `updated_at` (auto-trigger via `set_updated_at`)

RLS policies:
- Public `INSERT WITH CHECK (true)` — anyone can submit, no auth required
- Authenticated `SELECT`, `UPDATE`, `DELETE` — admin-only operations

### 2. Public Submission Form — `RequestListingModal`

New component: `src/components/RequestListingModal.tsx`

- Reuses existing validation patterns: `normalizePhone`, `isValidPhone`, `normalizeArea`, `formatTime`
- Reuses image upload + compress-to-WebP via `shop-images` bucket (same as ShopModal)
- Category field: shows dropdown if categories exist, falls back to free-text input
- Optional fields: WhatsApp, address, times, image, submitter name
- Two-stage UI: form → success screen with moderation-first messaging
- No auto-publish: status is always `pending` on insert
- Validation: name required, phone ≥10 digits, area OR address required, WhatsApp length check

### 3. Entry Point — Home Page FAB Replaced

- WhatsApp FAB removed (was a plain wa.me link to a phone number)
- Replaced with inline "List Your Shop — Free" section CTA button below the View All Shops CTA
- `RequestListingModal` mounts on click; unmounts on close or successful submit

### 4. Admin Review Queue — `RequestsTab`

New tab added to `AdminDashboard`:

- Tab button: **Requests** with a live badge showing pending count
- Status filter pills: Pending / Approved / Rejected / All
- Table columns: Shop name + phone + submitter name, Area, Category text, Status badge, Actions
- Actions per row:
  - 👁️ View details (opens detail dialog)
  - 👍 Approve (pending rows only)
  - 👎 Reject (pending rows only)
  - 🗑️ Delete (all rows)

### 5. Approve Workflow

On approval:
1. Normalises phone via `normalizePhone()` — consistent with ShopModal
2. **Duplicate phone check** against live `shops` table — blocks approval if match found, shows error toast
3. Case-insensitive category name lookup via `ilike` against `categories` table
4. Inserts shop with `is_active: true`, `is_verified: false` (admin can verify manually after)
5. Inserts `shop_categories` row if category resolved
6. Updates request status to `approved`
7. Invalidates `admin-shops`, `admin-stats`, `admin-requests` query caches

### 6. Reject Workflow

- Updates request status to `rejected`
- Does NOT create a shop entry
- Request remains visible in Rejected filter for audit trail

### 7. Stats Bar Update

- Added 5th stat card: **Pending** with badge count
- `StatCard` updated to support optional `highlight` prop (highlights count in secondary color when > 0)
- `TabButton` updated to support optional `badge` prop showing a numeric indicator

### 8. Moderation Safety Rules (Enforced)

- No public submission creates a live shop entry (status = pending always)
- Admin approval runs duplicate detection before inserting
- Rejected requests are preserved for audit, not auto-deleted
- No public user accounts, no auto-publish path exists

---

## V2 Phase 5 — Data Quality & Admin Cleanup Tools

> Scope: Category merge, area consistency panel, duplicate shop detection — data governance without destructive automation.

### 1. Category Merge Workflow

- **Merge button** (GitMerge icon) added per category row — visible only when `shopCount > 0`
- `CategoryMergeModal` component (inline, same file pattern as other modals):
  - Title: "Merge {icon} {name}"
  - Dropdown: select target category (all categories except source)
  - Shows reassignment preview: "X shops will be moved from A → B"
  - Checkbox: "Disable source category after merge" (checked by default)
  - Two-step confirmation: "Review & Confirm" → AlertDialog before execution
- **Merge logic** (safe):
  1. Fetches all `shop_categories` rows for source category
  2. Fetches existing `shop_categories` rows for target category
  3. Shops already linked to target: their source row is deleted (prevents duplicate join rows)
  4. Remaining shops: source `category_id` updated to target via `.in('id', reassignIds)` on `shop_categories`
  5. Optionally disables source category via `categories.update({ is_active: false })`
- Invalidates `admin-categories` and `admin-shops` query caches on success

### 2. DataQualityTab — Area Consistency Panel

New **"Data Quality"** tab (5th tab, Wrench icon) added to admin dashboard.

**Area Consistency section:**
- Queries all shops client-side, groups by `area` field via `useMemo`
- Table: Area name | Shop count | Rename action
- Sorted by shop count descending
- **Suspicious area badge** (⚠ orange) flagged when: length < 3, ALL_CAPS with 3+ letters, or numeric-only
- **Rename inline**: clicking Rename opens an input field in the same row; Enter to save, Escape to cancel
- **Rename execution**: single Supabase call `UPDATE shops SET area = newName WHERE area = oldName` — bulk-updates all shops with that area
- New area name is auto title-cased via `normalizeAreaValue()` before saving
- Invalidates `admin-shops` after rename; re-derives area list from updated data

### 3. DataQualityTab — Duplicate Shop Detector

**Possible Duplicates section:**

Two detection passes run client-side on the shop list:
1. **Phone duplicates**: normalizes each phone via `normalizePhone()`, groups shops sharing the same 10-digit number
2. **Name+area similarity**: groups shops sharing the same first-5-chars of lowercased name AND the same area string

Both passes are merged (deduped by shop ID pair) into `allDuplicateGroups`.

Each duplicate group renders as a card:
- Header shows count + warning indicator
- Each shop in the group shows: name, inactive badge (if applicable), phone, area, categories
- **Edit button** per shop opens existing `ShopModal` via `onEditShop` callback
- No auto-delete, no auto-merge — admin resolves manually
- Refresh button re-fetches shop list

Empty state shows a clean ✅ confirmation when no duplicates found.

### 4. What Was Kept Unchanged

- Category usage counts in CategoriesTab (`shopCount`) — ✅ unchanged
- Category delete dialog with linked shop names — ✅ unchanged
- Category edit/rename via CategoryModal — ✅ unchanged
- ShopModal duplicate phone detection — ✅ unchanged
- normalizeArea() in ShopModal and CSV import — ✅ unchanged
- All public filters, search, and browsing — ✅ unchanged

---

## Phase 5 — Intentionally Deferred

- Full Levenshtein text-similarity duplicate detection
- Bulk area reassignment (select multiple areas → merge into one)
- Category taxonomy hierarchy
- Shop CSV export
- Audit log of admin changes (who changed what, when)
- Area table with canonical names (enforce from a list)
- XLSX/Excel import
- Image import via CSV
- Per-row "force import anyway" override for duplicates
- Multi-category assignment in CSV import
- CSV export of engagement data
- Per-shop engagement drill-down / trend lines
- Notification system (email/push) on new request
- Multi-city support
- Admin notes field on approval/rejection
- Requester email/callback for status updates
- Re-open rejected request
- Bulk approve/reject

---

## Kept Unchanged (Verified Phase 1 + 2 + 3 + 4 + 5)

| Feature | Status |
|---|---|
| Phone normalization + WhatsApp wa.me links | ✅ unchanged |
| Duplicate phone detection dialog (ShopModal) | ✅ unchanged |
| Inactive shop 🔒 guard in ShopDetail | ✅ unchanged |
| Filter bottom sheet (area, availability, category, verified) | ✅ unchanged |
| Auto-refresh every 60s | ✅ unchanged |
| Category delete safety dialog | ✅ unchanged |
| Admin search: name, area, phone, address | ✅ unchanged |
| Analytics date range filter + top shops + top categories | ✅ unchanged |
| CSV bulk import with validation + preview + result | ✅ unchanged |
| Verified Only public filter toggle | ✅ unchanged |
| Public shop submission + admin review queue (Phase 4) | ✅ unchanged |

---

## V2 Phase 6 — Homepage Discovery, Trust Signals & Better Empty States

> Scope: Public-facing UX — featured verified shops, recently added section, contextual empty states, stronger trust signals.

### What Was Already There (Kept Unchanged)

| Feature | Status |
|---|---|
| `ShopCard` component (full card) | ✅ unchanged |
| Home `shops` query | ✅ unchanged — no new queries added |
| `StatPill` component | ✅ extended (not rebuilt) |
| Trust strip layout | ✅ kept, content improved |
| Category grid + sorting | ✅ unchanged |
| View All Shops CTA + List Your Shop CTA | ✅ unchanged |

---

### 1. Featured Verified Shops Section

- Added to `Home.tsx` between Category grid and View All CTA
- Derived from existing `shops` query via `useMemo` — **zero new network requests**
- Filter: `is_verified === true`, sorted by `created_at` desc, max 6 shops
- Hidden cleanly when `verifiedShops.length === 0`
- Header: ShieldCheck icon + "Verified Shops" + "View all →" link to `/shops?filter=verified`
- Sub-label: "Reviewed and confirmed by our team"
- Horizontal scroll row (`overflow-x-auto scrollbar-none`) with `CompactShopCard`

### 2. Recently Added Section

- Added after Featured Verified, before View All CTA
- Derived from same `shops` query — sorted by `created_at` desc, max 5 shops
- Quality filter: only shops with `name` + (`phone` OR `area`) are included
- Hidden when `recentShops.length < 3` (not useful with fewer entries)
- Same horizontal scroll row with `CompactShopCard`

### 3. CompactShopCard Component (inline in Home.tsx)

- Lightweight card: `w-[185px]`, category emoji icon, name (2-line clamp), area, open/closed dot, verified badge (if applicable)
- Quick actions: Call + WhatsApp buttons (both shown if available)
- Clickable → navigates to `/shop/:id`
- Reuses design tokens, no new classes

### 4. Verified Count StatPill

- `verifiedCount` derived via `useMemo` from existing `shops` data
- Added as 4th `StatPill` in hero stats row
- Hidden when `verifiedCount === 0`
- Icon: `ShieldCheck`

### 5. Trust Strip Improvements

- "Verified listings" → dynamically shows `{verifiedCount} verified listings` when count > 0
- Added 4th item: "Reviewed & maintained" — reinforces directory quality
- `ShieldCheck` icon replaces `Star` for verified slot

### 6. Verified Filter URL Param (`?filter=verified`)

- `Shops.tsx` now reads `searchParams.get('filter')` on load
- `verifiedOnly` state initialized to `filterParam === 'verified'`
- Allows "View all verified →" from homepage to pre-activate the verified filter
- Filter remains fully interactive after page load — not locked

### 7. Contextual Empty States — Shops.tsx

Replaced single generic empty state with scenario-specific messages:

| Scenario | Icon | Message | Primary Action |
|---|---|---|---|
| Search with no results | 🔍 | `No shops match "{search}"` | Clear search + Browse categories |
| Verified only, none found | ✅ | "No verified shops yet" | View all shops |
| Open only, none open | 🌙 | "No shops open right now" | Show all shops |
| Area filter, none in area | 📍 | `No shops found in {area}` | Clear area filter |
| Combo filters | 🔍 | "No shops match these filters" | Clear all filters |
| No data at all | 🏪 | "No shops listed yet" | Go Home |

### 8. Contextual Empty States — CategoryPage.tsx

- **With active filters**: "No {categoryName} shops match your filters" → [Clear filters]
- **No filters, category empty**: "No {categoryName} shops listed yet" → [View all shops] + [Browse categories]
- Category name used in message for natural reading ("No Grocery shops match your filters")

---

### Phase 6 — Intentionally Deferred

- Area browsing chips strip on homepage (horizontal scrollable area pills)
- "Recently Updated" shops (uses `updated_at` instead of `created_at`)
- Per-shop engagement drill-down in analytics
- Reviews or ratings
- Ads, public accounts, chat, notifications

---

## V2 Phase 7 — Bug Fixes, QA Hardening & Data Migrations

> Session: March 2026 | Retested all V2 features; fixed remaining issues

### Bug Fixes

| ID | Area | Fix |
|---|---|---|
| BUG-01 | Request approval — duplicate phone | `handleApprove` now uses same `normalizePhone()` (strips `+`, spaces, dashes, strips leading `91` from 12-digit) as ShopModal and CSV import |
| BUG-02 | Public request form — location optional | GPS coordinates, Google Maps link, and address are all optional in `RequestListingModal`; form submits without them |
| BUG-04 / BUG-C | Bilingual area normalisation | All four call sites (`ShopModal executeSave`, `handleApprove`, CSV `normalizeArea`, `RequestListingModal`) now use bilingual-safe regex `/(^|[\s,])([a-z])/g` instead of `\b\w` which breaks on Devanagari |
| BUG-05 / BUG-09 | Cache invalidation for public queries | `qc.invalidateQueries({ queryKey: ['shops'] })` added to CSV import `onDone` callback and to `handleApprove` so public pages reflect new shops immediately |
| BUG-06 | Storage audit pagination | Storage scan now loops with `from(offset, offset+999)` per page instead of a single call, so buckets with >1000 files are fully audited |
| BUG-07 | ShopCard type safety | `is_active` check on category uses `!== false` instead of boolean cast to handle `undefined` safely |
| BUG-08 | CompactShopCard engagement tracking | `logEngagement` added to Call and WhatsApp onClick handlers in `Home.tsx` compact shop cards; was missing despite being present on `ShopDetail` |
| BUG-10 | Overnight time validation | `RequestListingModal` time validation now only blocks identical open/close times, not close-before-open (overnight shops like 22:00–06:00 are valid) |
| R2 | Canvas image compression null guard | `canvas.toBlob()` callback guards against null blob before upload |
| R7 | Analytics query row limit | `shop_engagement` query raised to `.limit(5000)` to exceed Supabase default 1000-row cap |

### Category Merge RLS Fix
- The `shop_categories` table has no UPDATE RLS policy (by design — no UPDATE policy was ever created)
- Category merge previously attempted `.update()` on `shop_categories`, which silently failed
- Fixed: merge now uses **DELETE** (remove old links for source category) + **INSERT** (create new links for target category), bypassing the missing UPDATE policy entirely
- Duplicate prevention: target's existing links are fetched first; only missing links are inserted

### Data Migrations

**BUG-A — Backfill `shop_categories` from legacy `category_id`:**
Some pre-V2 shops had `category_id` set on the `shops` table but no corresponding row in the `shop_categories` junction table. These shops appeared uncategorised on public pages and were not filterable by category. Migration:
```sql
INSERT INTO public.shop_categories (shop_id, category_id)
SELECT s.id, s.category_id
FROM public.shops s
WHERE s.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.shop_categories sc WHERE sc.shop_id = s.id
  );
```
Also fixed in code: `ShopModal` now falls back to `shop.category_id` to pre-fill `selectedCategoryIds` when `shop_categories` is empty, so legacy shops are correctly handled on the next admin save.

**BUG-B — Delete orphaned `shop_categories` pointing to inactive categories:**
After a category merge with `disableSource=true`, some historical `shop_categories` rows still pointed to the now-inactive source category. These orphaned rows meant shops showed no category chip on their card (because `is_active=false` categories are filtered out at render time). Migration:
```sql
DELETE FROM public.shop_categories sc
USING public.categories c
WHERE sc.category_id = c.id
  AND c.is_active = false;
```

### Export Tools Added
Three new admin CSV export buttons added (same pattern as the existing Shops tab export):

| Tab | Button | Columns | Filename |
|---|---|---|---|
| Categories | Export CSV | Name, Icon, Active | `muktainagar-categories-YYYY-MM-DD.csv` |
| Requests | Export CSV | Name, Phone, WhatsApp, Area, Address, Category, Status, Submitter, Opening/Closing Time, Has Image, Submitted At | `muktainagar-requests-YYYY-MM-DD.csv` |
| Analytics | Export CSV (only shown when data exists) | Shop Name, Area, Calls, WhatsApp, Total | `muktainagar-analytics-YYYY-MM-DD.csv` |

All exports: UTF-8 BOM for Excel compatibility, client-side only, use already-loaded in-memory data (no extra queries).

### Retest Summary (all items verified clean)
- Duplicate phone detection: ShopModal add/edit, CSV import, request approval — PASS
- CSV import → public visibility: cache invalidation confirmed — PASS  
- Request approval → public visibility: cache invalidation confirmed — PASS
- Storage cleanup on request delete — PASS
- Storage cleanup on shop image replace — PASS
- Merged/deactivated categories: ShopCard, ShopDetail, filter UI — PASS
- CompactShopCard engagement tracking — PASS (BUG-08 fix)
- Overnight timings: `isShopOpen` logic, request form validation — PASS
- Analytics 5000-row limit confirmed in network log — PASS
- Bilingual area search via `ilike` (Postgres handles Unicode) — PASS

---

## V2 Phase 8 — Admin Productivity, SEO & PWA Polish

> Session: 9 March 2026  
> Scope: Zero-risk, high-value improvements — no schema changes, no major redesigns.  
> Vitest run after changes: ✅ all 1/1 tests passed.

---

### Audit Summary (9 March 2026)

Before making any changes, a full audit was performed. Items already correct were explicitly skipped:

| Item | Status |
|---|---|
| Home.tsx WhatsApp `091` normalization | ✅ already correct — skipped |
| ShopDetail `.eq('is_active', true)` DB filter | ✅ already correct — skipped |
| `pendingCount` dedicated query in RequestsTab | ✅ already correct — skipped |
| Filter bottom-sheet on Shops.tsx and CategoryPage.tsx | ✅ already correct — skipped |
| `og:title`, `og:description`, `og:image`, `twitter:card` in index.html | ✅ already correct — skipped |
| PWA manifest: `name`, `short_name`, `theme_color`, icons | ✅ already correct — skipped |
| Admin monolith split (10 component files) | ✅ already resolved — skipped |
| RISK-01 through RISK-10 audit items | ✅ all resolved in Phase 7 — skipped |

---

### A. Homepage Category Quick-Filter Chips

**File:** `src/pages/Home.tsx`

- Added a horizontally scrollable category chip strip **below the search bar**, above the stats pills
- Chips use the already-loaded `sortedCategories` array — **zero extra network requests**
- Shows up to **6 chips** maximum to keep the hero clean on mobile
- Each chip displays: `{icon} {name}` — clicking navigates to `/category/:id`
- A trailing **"More →"** chip navigates to `/shops` when there are more than 6 categories
- Chips use `overflow-x-auto scrollbar-none` for smooth native horizontal scroll on iOS and Android
- Styling uses design tokens (`bg-card`, `border-border`, `text-foreground`, `hover:bg-primary/10`, `hover:text-primary`) — no hardcoded colors
- Hidden when `sortedCategories.length === 0`
- **Why:** Satisfies user requirement #5 ("add filter option in homepage search bar") in a mobile-first, zero-risk way without a combobox overhaul

---

### B. Dynamic `document.title` per Page

**Files:** `src/pages/ShopDetail.tsx`, `src/pages/CategoryPage.tsx`, `src/pages/Shops.tsx`

Pattern used in all three:
```typescript
useEffect(() => {
  document.title = '<page-specific title>';
  return () => { document.title = 'Muktainagar Daily — Local Business Directory'; };
}, [dependency]);
```

| Page | Title format | Trigger |
|---|---|---|
| `ShopDetail.tsx` | `{shop.name} — Muktainagar Daily` | When shop data loads |
| `CategoryPage.tsx` | `{icon} {name} Shops — Muktainagar Daily` | When category data loads |
| `Shops.tsx` | `"{search}" — Muktainagar Daily` (when search active) | When `debouncedSearch` changes |
| `Shops.tsx` | `All Shops — Muktainagar Daily` (no search) | When `debouncedSearch` is empty |

- Cleanup function restores default title on unmount (prevents stale titles when navigating back to Home)
- **Why:** Improves browser tab labelling, bookmark names, PWA history, and helps users orient in multi-tab workflows

---

### C. SEO Meta Polish — `index.html`

**File:** `index.html`

Seven meta tags / link elements added:

```html
<link rel="canonical" href="https://muktainagar-daily.lovable.app" />
<meta name="robots" content="index, follow" />
<meta name="geo.region" content="IN-MH" />
<meta name="geo.placename" content="Muktainagar, Jalgaon, Maharashtra" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Muktainagar" />
```

| Tag | Purpose |
|---|---|
| `canonical` | Prevents duplicate-content penalties; tells Google the primary URL |
| `robots: index, follow` | Explicitly allows crawling and link-following |
| `geo.region: IN-MH` | ISO 3166 code; signals the geographic relevance of the directory |
| `geo.placename` | Human-readable location for geo-aware crawlers |
| `apple-mobile-web-app-capable` | Enables full-screen iOS PWA mode when added to home screen |
| `apple-mobile-web-app-status-bar-style` | Hides iOS status bar chrome in PWA mode |
| `apple-mobile-web-app-title` | Short name shown under the PWA icon on iOS home screen |

- `<html lang="en">` left unchanged (app is bilingual English + Marathi; setting `lang="mr"` would misclassify English content)

---

### D. PWA Manifest Polish

**File:** `public/manifest.json`

Three fields added:

```json
"lang": "mr",
"categories": ["local", "business", "shopping"],
"display_override": ["standalone", "browser"]
```

| Field | Purpose |
|---|---|
| `lang: "mr"` | Signals Marathi as the primary language of the app to browser install prompts and search |
| `categories` | W3C Web App Manifest categories — used by Chrome install banners and app store indexing |
| `display_override` | Allows the browser to prefer `standalone` mode; falls back to `browser` — improves install prompt eligibility on Chrome/Edge |

---

### E. Admin: Shop Quick-Preview Link (ShopsTab)

**File:** `src/components/admin/ShopsTab.tsx`

- Added an `<ExternalLink>` icon button in the **Actions column** of every shop row
- Links to `/shop/{shop.id}` with `target="_blank" rel="noopener noreferrer"`
- Opens the **public shop page** exactly as a visitor sees it — without leaving the admin dashboard
- Already existed in the code from the approved plan (ExternalLink import was already in the file)
- Zero state, zero mutations, zero DB calls
- **Why:** Removes the need for the admin to manually type the URL or navigate away from the dashboard to verify how a shop looks publicly

---

### F. Admin: `admin_notes` Field in RequestsTab View Modal

**File:** `src/components/admin/RequestsTab.tsx`

- The `admin_notes` column exists in the `shop_requests` table and is present in the TypeScript type but was **never displayed** in the view detail modal
- Added `admin_notes` to the field list in the view dialog alongside all other request fields
- Displayed as a read-only text block with a muted style; hidden entirely when the value is null/empty
- **Why:** Allows admins to see any previously saved notes on a request before making approve/reject decisions; prevents notes from being silently discarded in the UI

---

### What Was Intentionally Skipped (Phase 8)

| Item | Reason |
|---|---|
| Server-side rendering / dynamic OG images per shop | Requires SSR; out of scope for client-side React app |
| Admin notes editing (writable) | Field exists in DB; a mutation + save UX is a separate task (see V3 backlog) |
| PWA screenshots in manifest | Requires actual device screenshots and design work |
| `<html lang="mr">` | App is bilingual; setting lang to Marathi would misclassify English text |
| localStorage filter persistence on homepage | No user need stated; adds complexity |
| Keyboard shortcut for search | Premature at this scale |
| Category filter inside the search input box | Combobox overhaul would be risky; chip strip achieves the same goal more simply |
| Reviews, ads, chat, multi-city | Explicitly out of scope |

---

### Kept Unchanged (Verified Phase 1–7 + Phase 8)

| Feature | Status |
|---|---|
| Phone normalization + WhatsApp wa.me links | ✅ unchanged |
| Duplicate phone detection (ShopModal, CSV, approval) | ✅ unchanged |
| Inactive shop 🔒 guard in ShopDetail | ✅ unchanged |
| Filter bottom sheet (area, availability, category, verified) | ✅ unchanged |
| Auto-refresh every 60s | ✅ unchanged |
| Category merge DELETE+INSERT pattern | ✅ unchanged |
| Analytics date range + top shops + top categories + export | ✅ unchanged |
| CSV bulk import with validation + preview + result | ✅ unchanged |
| Public shop submission + admin review queue | ✅ unchanged |
| DataQuality tab (area rename, duplicate detector, storage audit) | ✅ unchanged |
| Featured Verified + Recently Added compact scroll rows | ✅ unchanged |
| Contextual empty states on Shops.tsx and CategoryPage.tsx | ✅ unchanged |
| Engagement tracking (ShopDetail + CompactShopCard) | ✅ unchanged |

