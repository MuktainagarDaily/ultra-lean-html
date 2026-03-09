
## What the user wants
Remove the simple horizontal chip strip added below the search bar in `Home.tsx` (lines 283–307) and replace it with **the same filter button + bottom-sheet drawer** that exists on the Shops page — but adapted to work on the homepage.

## How the Shops page filter works (exact pattern to replicate)
- A `SlidersHorizontal` "Filters" button opens a `<Drawer>` bottom sheet
- Inside the sheet: Availability (All/Open/Closed), Area/Locality checkboxes, Category chips, Verified toggle
- "Show N Shops" CTA applies filters and closes
- Active filter pills show next to the button; each pill has an `×` to remove it
- Sheet uses *temporary* state synced from applied state when it opens

## What changes on Home.tsx specifically
The homepage search navigates away to `/shops?search=…`. So the filter should do the same — when the user picks filters and hits "Show X Shops", navigate to `/shops` with the relevant filter pre-applied. The cleanest approach:

- **Navigate with query params** on Apply: `/shops?search=…&filter=verified`, or simply navigate to `/shops` and pre-populate state via URL params.
- Looking at Shops.tsx: it reads `searchParams.get('filter')` for `verified` (line 48) and `searchParams.get('search')` — but there's no URL param for availability, area, or category. So for simplicity, clicking "Show Shops" from the homepage drawer navigates to `/shops` with `search` + `filter=verified` if verified is selected. For availability=open, navigate with `filter=open` (Shops.tsx doesn't read that yet — we'd need to add `filterParam === 'open'` handling).

Actually a cleaner approach: the homepage filter drawer pre-filters and then navigates to `/shops` with all selected filters encoded in URL params. But Shops.tsx doesn't read those params yet for area/category. This would require modifying Shops.tsx too — which is more risk.

**Simpler, safer approach**: The homepage drawer shows the same UI but on "Show X Shops" it navigates to `/shops` with only `search` and `filter=verified` (already supported). For availability `open`, we add reading `filter=open` in Shops.tsx (1 line). Area and category don't get pre-populated from home — user can refine further on the Shops page. This is still far better than the current chip strip.

Actually, let me reconsider. The user said "place the same filter option which is in shop page". They likely mean the same **UI interaction** (Filters button → bottom drawer with the same sections), not necessarily that the results show on the homepage. The natural UX would be: pick filters → navigate to `/shops` with those filters applied.

**Cleanest safe approach:**
1. Remove the chip strip (lines 283–307)
2. Add a "Filters" button row below the search form (same style as Shops.tsx filter bar)
3. Add the same `<Drawer>` bottom sheet with Availability + Category sections (skip Area since categories are already loaded; Area requires shops data which Home also has)
4. On "Show X Shops" → `navigate('/shops')` — but we can't easily pass complex filter state via URL for areas/categories

Wait — Home.tsx already loads `shops` (all active). So we have `areaOptions` and `categoryOptions` available from the `shops` query that's already there. The filter count preview can be computed client-side. On apply, navigate to `/shops` (the Shops page will just show all shops with their own filter drawer).

**Final decision**: The most practical & non-breaking implementation:
- Remove the chip strip
- Add a `Filters` button below the search bar (same style)  
- Clicking it opens a drawer with Availability / Category / Verified sections (same UI as Shops page)
- `areaOptions` and `categoryOptions` derive from the existing `shops` query (already loaded)
- Preview count uses the same `applyFilters` logic
- On Apply → navigate to `/shops` (optionally append `filter=verified` or `filter=open` as URL params for the two supported ones)
- For availability=open, we pass `?filter=open` — Shops.tsx already handles `filterParam === 'verified'`, we add one line for `filterParam === 'open'`

This means:
- `src/pages/Home.tsx`: Remove chips, add filter state + drawer (same as Shops.tsx pattern)
- `src/pages/Shops.tsx`: Add 1 line to initialise availability from URL param `filter=open`

## Exact file changes

### `src/pages/Home.tsx`
1. Add imports: `useEffect`, `SlidersHorizontal`, `X`, `Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerTitle` from respective packages
2. Add filter state variables (same names as Shops.tsx sheet state)
3. Derive `areaOptions` and `categoryOptions` from existing `shops` data (same memos as Shops.tsx)
4. Add `applyFilters` callback (same as Shops.tsx)
5. Add `sheetPreviewCount` memo
6. Remove lines 283–307 (the chip strip)
7. Add the Filters button row below the search form (identical styling to Shops.tsx)
8. Add the `<Drawer>` bottom sheet JSX (copy from Shops.tsx, adapt for home context)
9. On Apply: navigate to `/shops` + optionally `?filter=verified` or `?filter=open`

### `src/pages/Shops.tsx`
- Line 48: change `setAvailability(filterParam === 'verified')` ... actually availability is separate. Add: `const [availability, setAvailability] = useState<AvailabilityFilter>(filterParam === 'open' ? 'open' : 'all');` — already that's what line 45 does but without reading filterParam. Change line 45 to `useState<AvailabilityFilter>(filterParam === 'open' ? 'open' : 'all')`.

## Risk assessment
- All additive changes to Home.tsx
- 1-line change to Shops.tsx (read `filter=open` from URL)
- No schema changes
- No new queries (reuse existing `shops` data)
- Drawer/Sheet is already a dependency in the project
