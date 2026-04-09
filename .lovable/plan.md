## Project Audit — Findings & Fix Plan

### Issues Found

**1. Dead Code: `src/pages/Index.tsx` + unused assets**

- The "MyStudio" template page is not referenced in any route in `App.tsx`. It imports `hero-image.jpg` and `about-image.jpg` from assets — both are dead weight in the bundle.
- **Fix**: Delete `src/pages/Index.tsx`, `src/assets/hero-image.jpg`, `src/assets/about-image.jpg`.

**2. Dead Code: `src/pages/CategoryPage.tsx**`

- Never imported or routed anywhere in `App.tsx`. The `/category/:id` route uses `CategoryRedirect` which redirects to `/shops?category=...`. This entire 386-line file is unused.
- **Fix**: Delete `src/pages/CategoryPage.tsx`.

**3. Duplicate Open/Closed Indicator in ShopDetail (Bug)**

- When a shop has an image, the OPEN/CLOSED badge renders **twice**: once overlaid on the image (lines 186-204) AND again in the Name+Status card below (lines 265-289). Both show identical info.
- **Fix**: Remove the badge from the Name+Status card (lines 265-289). Keep only the image overlay badge. When there's no image, show the badge inline in the Name+Status card instead.

**4. "List Your Shop" CTA — Remove from Home bottom**

- Lines 667-681 in `Home.tsx` show a "List Your Shop — Free" button. User wants this removed from client side.
- **Fix**: Delete the section (lines 667-681).

**5. Console Error: Missing DialogTitle in UserMenuDrawer**

- The `DrawerHeader` uses `sr-only` class but the `DrawerContent` still triggers a Radix accessibility warning about missing `DialogTitle`. The `<DrawerHeader className="sr-only">User Menu</DrawerHeader>` approach needs the title inside a `DrawerTitle`.
- **Fix**: Change to `<DrawerHeader className="sr-only"><DrawerTitle>User Menu</DrawerTitle></DrawerHeader>`.

**6. Home.tsx — Unused local filter state (dead logic)**

- Home has full filter state management (availability, selectedAreas, selectedCategories, verifiedOnly + sheet equivalents) with 8 `useState` hooks and helper functions. But these filters are never applied to any content on the Home page — `handleApplyAndNavigate` just navigates to `/shops`. The filter drawer on Home is identical to Shops but redundant.
- **Fix**: Remove the filter bar, filter state, filter drawer, and all related handlers from Home. Keep only the search bar and stat pills for navigation. This removes ~150 lines of dead state management and a heavy Drawer component from the Home render tree.
- user need filter option in home page

**7. `isShopOpen` called redundantly in filter chains**

- In `Shops.tsx` and `Home.tsx`, `applyFilters` calls `isShopOpen(s)` potentially twice per shop (once for `open` check, once for `closed` check). With `sheetPreviewCount` + `filteredShops` + `openCount` all computing independently, the same shops get `isShopOpen` called 3-4 times per render.
- **Fix**: Pre-compute `isShopOpen` once per shop using `useMemo` that maps shop IDs to open status, then reference the map in all filters. This reduces repeated date arithmetic.

**8. CompactShopCard engagement logging — no error handling**

- `CompactShopCard` in Home.tsx (line 37) has `logEngagement` without try/catch, unlike `ShopDetail.tsx` which properly wraps it. A Supabase error could cause an unhandled promise rejection.
- **Fix**: Add try/catch to match ShopDetail's pattern.

**9. Pagination ellipsis logic bug in Shops.tsx**

- The ellipsis rendering (lines 462-468) has a logic issue: it only shows `…` at position 2 or `totalPages-1` under specific conditions, but pages 3, 4, etc. in gaps between shown pages return `null` — no ellipsis rendered for those gaps.
- **Fix**: Use a cleaner ellipsis algorithm: track if last rendered page was non-consecutive, if so insert `…`.

**10. QueryClient cache — already well configured**

- `staleTime: 30s`, `gcTime: 5min`, `refetchOnWindowFocus: false` are all good. No changes needed.

---

### Summary of Changes


| File                                | Action                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/pages/Index.tsx`               | **Delete** — dead code                                                                                          |
| `src/assets/hero-image.jpg`         | **Delete** — dead asset                                                                                         |
| `src/assets/about-image.jpg`        | **Delete** — dead asset                                                                                         |
| `src/pages/CategoryPage.tsx`        | **Delete** — dead code (never routed)                                                                           |
| `src/pages/ShopDetail.tsx`          | Fix duplicate open indicator — show badge on image OR in card, never both                                       |
| `src/pages/Home.tsx`                | Remove "List Your Shop" CTA; remove unused filter state/drawer (~150 lines); fix CompactShopCard error handling |
| `src/components/UserMenuDrawer.tsx` | Fix DrawerTitle accessibility warning                                                                           |
| `src/pages/Shops.tsx`               | Fix pagination ellipsis logic; pre-compute `isShopOpen` map                                                     |


No database changes. No Lovable Cloud. No `.env` changes.