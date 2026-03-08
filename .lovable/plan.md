
## Current state analysis

**What exists today:**
- `Shops.tsx`: horizontal scrollable chip strip in the sticky header — Open Now chip + area chips all in one flat row
- `CategoryPage.tsx`: same pattern — flat horizontal scroll
- Problems the user describes:
  1. Too many chips crammed in one flat scrollable row — hard to discover on mobile
  2. No "All / Open / Closed" toggle (just a binary Open Now chip)
  3. No multi-select area (can only pick one at a time)
  4. No category filter on the Shops page
  5. No dedicated filter UI that shows all options at once — must scroll horizontally hoping to find something
  6. Hard to tell which filters are active at a glance

---

## Design approach: Filter Bottom Sheet

**Pattern:** A single "Filters" button in the header row opens a **bottom drawer/sheet** on tap. Inside the sheet, all filter groups are visible at once. This is the standard mobile pattern used by Swiggy, Zomato, Google Maps etc.

**Why bottom sheet (not modal, not inline):**
- Bottom sheet = natural thumb zone on mobile
- All filters visible at once — no horizontal scrolling to discover
- Multi-select works naturally in a sheet
- Easy to add future filter groups (e.g. Verified Only, Category) without touching header layout
- `vaul` drawer is already installed in the project

**Active filter summary:** A compact active-filter pill strip below the search bar shows currently applied filters with × to clear individually. This replaces the current chip row.

---

## Filter groups inside the sheet

### Sheet layout (3 sections, stacked vertically):

**1. Availability**
Three toggle buttons (pill style): `All Shops` | `Open Now` | `Closed Now`
- Replaces the current binary Open Now chip
- Single-select

**2. Area / Locality** (only on Shops page — CategoryPage has fewer areas)
Vertical checklist of area options with checkboxes (multi-select allowed)
- Areas derived from current data (same logic as now)
- "Select All" / "Clear" shortcut at top

**3. Category** *(Shops page only — already has data via shop_categories join)*
Horizontal pill multi-select grid (same as area, but categories from the shop data)
- Uses `shop.shop_categories` already joined in the query
- CategoryPage doesn't need this (already scoped to one category)

---

## Active filter bar (replaces current chip row)

A slim row below the search bar:
- "🔽 Filters" button (left) — shows badge count of active filters (e.g. "Filters · 2")
- Active filter pills (right): e.g. `Open Now ×` `Main Road ×`
- "Clear all" link if any filter active

This row is always visible but compact. No horizontal scroll needed.

---

## Files to change

**`src/pages/Shops.tsx`** — main rewrite of filter state + header UI + sheet
- State: `openFilter: 'all'|'open'|'closed'`, `selectedAreas: string[]`, `selectedCategories: string[]`
- Replace flat chip row with active-filter summary row + Filter button
- Add `FilterSheet` component (inline) using `vaul` Drawer
- `filteredShops` updated to handle multi-area and category filter

**`src/pages/CategoryPage.tsx`** — same pattern but simpler (no category filter, just Availability + Area)
- Replace flat chip row with the same Filter button + active-filter summary row
- Same FilterSheet, fewer sections

**No new files needed** — both sheets are self-contained inline components.

---

## What is NOT changed
- `ShopCard` — untouched
- `ShopDetail` — untouched
- Search input logic — untouched
- Auto-refresh / Open Now count logic — untouched
- Routing, query keys, Supabase queries — untouched
- Admin pages — untouched
- `index.css`, `tailwind.config.ts` — untouched

---

## Visual sketch

```text
┌─────────────────────────────────────┐  ← sticky header
│  ← All Shops              🔄        │
│    12 shops • 7 open now            │
│  [🔍 Search by name, area...]  [×]  │
│  [⚙ Filters · 2]  Open Now ×  Sta.. │  ← active filter bar
└─────────────────────────────────────┘

     ↓ tap "Filters"

┌─────────────────────────────────────┐
│  ▬▬▬ (drawer handle)               │
│  Filters           [Clear all]      │
│                                     │
│  AVAILABILITY                       │
│  [All Shops] [Open Now✓] [Closed]   │
│                                     │
│  AREA / LOCALITY  (2 selected)      │
│  □ Station Road   □ Main Road ✓     │
│  □ Near Chowk ✓   □ Old Town        │
│                                     │
│  CATEGORY                           │
│  [🛒 Grocery ✓] [💇 Salon] [🔧 HW] │
│                                     │
│  [   Show 8 Results   ]  ← CTA      │
└─────────────────────────────────────┘
```

---

## Implementation details

**Multi-select areas:** `selectedAreas: Set<string>` (or `string[]`). Toggle: if area in set, remove; else add.

**Category filter (Shops.tsx only):** Derive `categoryOptions` from fetched shops using the same `shop_categories` join that's already in the query. Filter: `filteredShops` checks if ANY of shop's categories is in `selectedCategories`.

**"Show N Results" CTA:** Count filtered results in real time as user adjusts filters in the sheet — gives instant feedback before closing. Computed from `useMemo` passed into the sheet.

**Active filter count badge on the Filter button:** `activeFilterCount = (openFilter !== 'all' ? 1 : 0) + selectedAreas.length + selectedCategories.length`

**Availability state:** `'all' | 'open' | 'closed'` — replaces the boolean `openNowOnly`. `filteredShops` logic: if `'open'` → `isShopOpen(s)`, if `'closed'` → `!isShopOpen(s)`, else no filter.

**CategoryPage:** Simpler — only Availability + Area. No category filter (already category-scoped). Same sheet pattern.

**vaul drawer:** Already installed. Use `Drawer`, `DrawerContent`, `DrawerHeader` from `src/components/ui/drawer.tsx`.
