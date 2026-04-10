

## Plan: Enhance Filter UI/UX + Add Autocomplete to Shops Page

### What exists now
- **Home page**: Has autocomplete search (top 5 suggestions), filter drawer with availability/area/category/verified, active filter pills, stat pills
- **Shops page**: Has search input (no autocomplete), same filter drawer pattern, active filter pills, pagination
- Both pages have nearly identical filter drawer code (duplicated)

### Changes

#### 1. Add autocomplete to Shops page search box
Port the same autocomplete dropdown pattern from Home.tsx into Shops.tsx:
- Add `searchFocused` state and `onFocus`/`onBlur` handlers to the search input
- Compute `searchSuggestions` from the loaded shops data (same haystack logic: name, area, sub_area, address, description, keywords, category names)
- Render the dropdown below the search input with shop name, area, and category badge
- Clicking a suggestion navigates to `/shop/:slug`
- The dropdown uses `z-[999]` and `max-h-[320px] overflow-y-auto` to stay visible

#### 2. Enhance filter UI/UX on both pages
Small, safe UX improvements — no redesign:

**Quick filter chips (both pages):**
- Add inline quick-filter chips below the search bar for the most common actions: "Open Now", "Verified", and top 3 categories — one tap to toggle without opening the drawer
- These sit in the existing horizontal scroll bar alongside active filter pills

**Filter drawer improvements (both pages):**
- Add a search/filter input inside the Area section when there are 6+ areas (helps users find their area fast)
- Show shop count next to each category chip in the filter drawer (e.g., "🛒 Grocery (12)")
- Show shop count next to each area option (e.g., "Main Road (8)")

**Active filter summary (Shops page):**
- When filters are active, show a subtle results summary bar above the shop list: "Showing 15 open shops in Main Road"

### Files changed

| File | Change |
|---|---|
| `src/pages/Shops.tsx` | Add autocomplete dropdown to search, add quick-filter chips, add area search in drawer, show counts in drawer, results summary bar |
| `src/pages/Home.tsx` | Add quick-filter chips, add area search in drawer, show counts in drawer |

### Technical notes
- No database changes needed
- No new dependencies
- Reuses existing shop data already fetched via React Query
- Autocomplete logic is client-side (same as Home page) — no extra API calls
- All counts are computed from the already-loaded shops array
- Mobile-first: quick chips are horizontally scrollable, area search input is compact

