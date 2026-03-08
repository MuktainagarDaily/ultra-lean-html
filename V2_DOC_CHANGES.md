# V2_DOC_CHANGES.md — V2 Phase 1 Changes

> Generated: March 2026
> Scope: V2 Phase 1 — Area filter, Verified badge on listing cards, Category usage counts in admin

---

## Changes Made

### 1. Area Filter — Shops Page (`src/pages/Shops.tsx`)

**What changed:**
- Fetched shop data now derives a sorted list of unique, non-empty `area` values.
- A horizontally scrollable chip strip is rendered below the search bar in the sticky header.
- Each chip shows a `MapPin` icon + area name. Tapping toggles selection (active chip turns white/inverted).
- Area filter stacks with existing Open Now filter and search — all three work together.
- Empty state updated to show `📍` with "No shops in <area>" message when area filter active.
- "Clear area filter" button added to empty-state actions.

**Behavior:**
- Default: no area selected — all shops shown (unchanged behavior).
- Selecting an area chip filters `filteredShops` client-side (no extra DB round trip).
- Chips only appear for areas that actually exist in the current result set.
- Junk/empty `area` values are excluded (`s.area?.trim()` guard).

---

### 2. Area Filter — Category Page (`src/pages/CategoryPage.tsx`)

**What changed:**
- Same area chip pattern added to the CategoryPage header filter strip.
- Open Now chip moved into the unified filter chips row for visual consistency.
- Area options derived from shops in that category only (correct scope).
- Empty state updated with area-specific messaging.

---

### 3. Verified Badge on ShopCard (`src/components/ShopCard.tsx`)

**What changed:**
- `ShieldCheck` icon imported from lucide-react.
- When `shop.is_verified === true`, a small `🛡 Verified` pill is rendered inline next to the shop name.
- Style matches the existing verified badge on `ShopDetail.tsx` — primary color tint background, primary text.
- Badge only renders when verified; no layout change for unverified shops.
- Card layout preserved; badge wraps naturally in the flex row.

---

### 4. Category Usage Counts in Admin (`src/pages/AdminDashboard.tsx`)

**What changed:**
- `CategoriesTab` query now fetches both `categories` and all `shop_categories` rows in parallel (`Promise.all`).
- A `countMap` is built from `shop_categories.category_id` — O(n) aggregation in JS.
- Each category object is extended with `shopCount: number`.
- A new "Shops" column added to the categories table (hidden on mobile with `hidden sm:table-cell`).
- Count displayed as a small badge: primary-tinted pill showing the number, e.g. `12`.
- Categories with 0 shops show a muted "0" badge.

---

## Verified Unchanged — Still True

| Claim | Status |
|---|---|
| Phone normalization + WhatsApp wa.me links | ✅ unchanged |
| Duplicate phone detection dialog | ✅ unchanged |
| Inactive shop 🔒 guard in ShopDetail | ✅ unchanged |
| Open Now filter behavior on Shops + CategoryPage | ✅ unchanged |
| Auto-refresh every 60s | ✅ unchanged |
| Category delete safety dialog with linked shop names | ✅ unchanged |
| Admin search: name, area, phone, address | ✅ unchanged |
| Public search: name, area, address + numeric phone | ✅ unchanged |
| Engagement logging (call/whatsapp) in ShopDetail | ✅ unchanged |
| Analytics tab | ✅ unchanged |
| Hero gradient, trust strip, Marathi placeholder, FAB | ✅ unchanged |
