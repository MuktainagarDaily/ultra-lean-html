# V2_DOC_CHANGES.md — V2 Changes Log

> Generated: March 2026
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

