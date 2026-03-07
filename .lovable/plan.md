## Full Audit Findings

**Critical Issues:**

1. `QueryClient` has no config — no stale time, no retry settings, no cache time. Every page visit re-fetches. On slow networks this causes blank screens.
2. `isShopOpen()` is called fresh every render — no auto-refresh timer anywhere. Status can be stale for the entire session.
3. `Home.tsx` has no loading skeleton for categories — shows "Loading categories..." plain text which feels broken.
4. `CategoryPage.tsx` does 2 sequential DB queries (get shop IDs → get shops) — slow on low-end networks; should use a single join.
5. `AdminDashboard.tsx` ShopsTab queries `categories(name)` via `category_id` FK (old legacy column), but multi-category data lives in `shop_categories`. So "Category" column in admin table is always blank.
6. No `useCallback`/`useMemo` optimizations anywhere — unnecessary re-renders on every keystroke in search.
7. WhatsApp FAB overlaps content on small screens — no bottom padding on pages.
8. `src/App.css` still exists with Vite boilerplate (`.logo`, `.card`, etc.) — dead code loaded on every page.
9. No offline/error fallback — network errors show nothing or raw error.
10. `formatAdminTime` in `AdminDashboard.tsx` is a wrapper that just calls `formatTime` — unnecessary indirection.

**UI/UX Issues:**

1. Home hero is plain blue — no gradient, no visual depth, feels flat.
2. Category grid uses basic white cards with no visual hierarchy or hover depth.
3. ShopCard OPEN/CLOSED badge is small and hard to read at a glance.
4. No shop count badge on categories (users can't tell which categories have shops).
5. Shop images don't load lazily with a blur placeholder — jarring layout shift.
6. Admin dashboard has no search/filter on the shops table — hard to find shops with many listings.
7. Footer is barely visible and adds no value.
8. No "open now" filter toggle on Shops page.

**Features to Add (prioritized):**

1. Auto-refresh open/closed every 60 seconds via `useInterval` hook
2. "Open Now" filter toggle on Shops/Category pages
3. QueryClient with smart stale/cache config (30s stale, 5min cache)
4. Skeleton loading states everywhere (replace plain text)
5. Better Home hero with gradient + stats bar (total shops count)
6. Category cards with shop count badges
7. Admin shop table: search + category filter
8. Sticky "Open Now" filter on Shops page
9. Pull-to-refresh hint (visual) on mobile
10. Error state with retry button for failed fetches
11. Bottom padding fix so FAB doesn't cover content
12. Improve category icons in home page.

---

## Plan

### 1. Performance & Data Layer (`src/App.tsx`, `src/lib/shopUtils.ts`)

- Configure `QueryClient` with `staleTime: 30_000`, `gcTime: 300_000`, `retry: 1` to cache data between pages and reduce network calls on slow connections
- Add `useInterval` hook (`src/hooks/useInterval.ts`) for the 60-second open/closed auto-refresh
- Fix `CategoryPage.tsx` to use a single joined query instead of two sequential ones

### 2. New Features: Open Now Filter + Auto-Refresh

- Add `useInterval` that calls `queryClient.invalidateQueries(['shops'])` every 60 seconds
- Add "Open Now" toggle button to `Shops.tsx` and `CategoryPage.tsx` headers — client-side filter (no extra DB call)
- Shops page shows count of "X open now" dynamically

### 3. Home Page — Professional Hero Redesign

- Gradient header (`from-primary to-primary/80`) with subtle decorative elements
- Stats bar below search showing live total shop count + category count
- Category cards: gradient icon backgrounds, hover lift shadow, shop count badge on each
- "View All Shops" button becomes a section with open-now count chip

### 4. ShopCard — Enhanced UI

- Larger OPEN/CLOSED badge with pulsing green dot animation for open shops
- Image thumbnail in card (if available) with lazy load
- Better action button row styling — icons + labels, not just text

### 5. Shops & Category Pages

- Skeleton shimmer cards (proper height/width, not just grey blocks)
- "Open Now" filter chip in the header
- Empty state with better illustration and call-to-action
- Category page: single query (join fix)

### 6. Admin Dashboard

- Fix category display in shops table (use `shop_categories` join, not legacy `categories`)
- Add search bar to shops tab to filter by name
- Admin stats header (total shops, active shops, categories)
- Remove dead `formatAdminTime` wrapper

### 7. Global Polish

- Delete boilerplate from `src/App.css`
- Add `pb-24` to all page `<main>` elements so FAB doesn't overlap last item
- Add `useEffect`-based error boundary with friendly error + retry in Shops/CategoryPage
- Font display: `swap` already set via Google Fonts URL — good
- Add `loading="lazy"` + blur placeholder to all shop images

### Files to Edit

```
src/App.tsx                     — QueryClient config, lazy route imports
src/App.css                     — remove boilerplate
src/lib/shopUtils.ts            — no change needed
src/hooks/useInterval.ts        — NEW: 60s auto-refresh hook
src/pages/Home.tsx              — hero redesign, stats, category card upgrade
src/pages/Shops.tsx             — Open Now filter, skeletons, bottom padding, auto-refresh
src/pages/CategoryPage.tsx      — single query fix, Open Now filter, skeletons
src/components/ShopCard.tsx     — pulsing badge, image thumb, better buttons
src/pages/ShopDetail.tsx        — bottom padding, image lazy load
src/pages/AdminDashboard.tsx    — fix category column, add search, stats, remove dead fn
```

No database migrations needed — all improvements are frontend only.