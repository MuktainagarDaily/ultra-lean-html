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

## Phase 3 — Intentionally Not Added Yet

- CSV export of engagement data
- Custom calendar date picker (ISO cutoff chips are sufficient)
- Per-shop engagement detail page / drill-down
- Trend lines / time-series charts
- Notification system
- Public shop submission flow
- Multi-city support
