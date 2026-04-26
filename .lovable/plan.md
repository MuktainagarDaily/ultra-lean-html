## Problem

On `/shops`, when the user applies filters (areas, categories, availability, verified, search), opens a shop detail page, and presses **Back**, the filters disappear.

**Root cause** (`src/pages/Shops.tsx`):
- Filter state is initialized from URL params **once** on mount (lines 43–54).
- Applied filters (especially areas, verified, availability changes from the drawer, and typed search) are **never written back to the URL**.
- `ShopDetail`'s back button uses `navigate(-1)`, which returns to the previous URL — which still reflects the original entry state, not the user's applied filters.
- So Shops re-mounts with stale/empty params and resets to defaults.

## Fix

Make the URL the source of truth for filter state by syncing changes back into `searchParams` with `{ replace: true }` (so we don't bloat browser history with one entry per filter toggle). On back-navigation, the URL already carries the filters, and existing init logic restores them.

### Changes in `src/pages/Shops.tsx`

1. **Add a sync effect** that writes current filter state to URL whenever it changes:
   ```ts
   useEffect(() => {
     const params = new URLSearchParams();
     if (debouncedSearch) params.set('search', debouncedSearch);
     if (availability === 'open') params.set('filter', 'open');
     else if (verifiedOnly) params.set('filter', 'verified');
     selectedAreas.forEach(a => params.append('area', a));
     selectedCategories.forEach(c => params.append('category', c));
     setSearchParams(params, { replace: true });
   }, [debouncedSearch, availability, verifiedOnly, selectedAreas, selectedCategories]);
   ```
   - Uses `replace: true` so back button still goes to the previous *page*, not through every filter tweak.
   - Switch the destructure to `const [searchParams, setSearchParams] = useSearchParams();`.

2. **Expand initial state hydration** (lines 43–54) to read multi-value params:
   - `searchParams.getAll('area')` → `selectedAreas` initial value
   - `searchParams.getAll('category')` → merge with single `category` param for backward compat with existing links from Home/category redirects
   - Keep existing `filter=open|verified` and `search` handling.

3. **No changes needed** to ShopDetail or ShopCard — `navigate(-1)` will now return to a URL that already encodes the filters, and Shops will rehydrate them on mount.

### Why this is safe

- `replace: true` prevents history pollution — back-button UX stays one-step-per-page.
- Existing entry points (`/shops?category=Foo`, `/shops?filter=open`, `/shops?search=...`) keep working since the hydration step is a superset.
- Shareable filtered URLs become a free bonus (e.g. user can copy URL with active filters).
- Pure client-side; no DB / schema / env changes.

### Files to change

| File | Change |
|---|---|
| `src/pages/Shops.tsx` | Use `setSearchParams`; add sync-to-URL effect; hydrate multi-value `area`/`category` params on mount |

No other files, no DB migrations, no `.env` changes.
