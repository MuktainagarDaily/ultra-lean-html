
## Summary of all changes

4 tasks across 4 areas: CSV fields, category pagination, shops pagination, category routing.

---

### 1 — CSV Export & Import: add missing fields

**`src/components/admin/ShopsTab.tsx` — `exportCsv` function**

Current headers: `Name, Phone, WhatsApp, Area, Address, Categories, Active, Verified`

New headers to add: `Sub Area, Description, Keywords, Opening Time, Closing Time, Latitude, Longitude, Is Open`

```
New headers (13 total):
Name | Phone | WhatsApp | Area | Sub Area | Address | Description | Keywords
Opening Time | Closing Time | Latitude | Longitude | Categories | Active | Verified | Is Open
```

Each row gains the extra fields mapped from the shop object.

---

**`src/components/admin/CsvImportModal.tsx` — template + import processor**

`CSV_TEMPLATE_HEADERS` currently has 12 cols. Add: `sub_area`, `description`, `keywords`.

`CSV_TEMPLATE_EXAMPLE` gets placeholder values for those three.

In `processText`, extract the three new fields from `raw` and include them in the `ImportRow` type and the `payload` built in `handleImport`.

No DB schema change needed — columns already exist in `shops` table.

---

### 2 — Home page: category "View more" pagination

**`src/pages/Home.tsx`**

Add state: `const [catPage, setCatPage] = useState(1);`

`CATS_PER_PAGE = 6`

```
visibleCategories = sortedCategories.slice(0, catPage * CATS_PER_PAGE)
hasMoreCats = sortedCategories.length > catPage * CATS_PER_PAGE
```

Replace the flat `sortedCategories.map(...)` grid with `visibleCategories.map(...)`.

Below the grid, render a "View more X categories →" button when `hasMoreCats` is true:

```jsx
{hasMoreCats && (
  <button onClick={() => setCatPage(p => p + 1)}
    className="w-full mt-3 py-2.5 rounded-xl border border-border text-sm font-semibold
               text-primary hover:bg-muted/50 transition-colors">
    View more ({sortedCategories.length - catPage * 6} more categories)
  </button>
)}
```

`CategorySkeleton` stays unchanged (still renders 6 placeholder cards).

---

### 3 — Shops page: 10-per-page pagination with background preload

**`src/pages/Shops.tsx`**

Strategy: keep the existing query fetching all matching shops (no DB change needed), do pagination entirely in memory. This is fastest and avoids extra round-trips.

Add state: `const [page, setPage] = useState(1);`
`PAGE_SIZE = 10`

Reset page to 1 whenever filters/search change (add `useEffect`).

```
const totalPages = Math.ceil(filteredShops.length / PAGE_SIZE);
const pagedShops = filteredShops.slice(0, page * PAGE_SIZE);
const hasMore = page < totalPages;
```

Background preload: when rendering page N, `useEffect` fires after paint to prefetch the next batch silently — since all data is already in memory, this is just a slice operation. No actual network call needed because all shops are fetched once. The "background load" is purely rendering the next slice when page changes without blocking current view.

Replace `filteredShops.map(...)` with `pagedShops.map(...)`.

Add a bottom pagination control:

```jsx
{hasMore && (
  <button onClick={() => setPage(p => p + 1)}
    className="w-full mt-4 py-3 rounded-xl border border-primary/30 text-primary
               font-semibold text-sm hover:bg-primary/5 transition-colors">
    Load more ({filteredShops.length - pagedShops.length} remaining)
  </button>
)}
{!hasMore && filteredShops.length > PAGE_SIZE && (
  <p className="text-center text-xs text-muted-foreground mt-4">
    All {filteredShops.length} shops shown
  </p>
)}
```

Update the header subtitle to show `${pagedShops.length} of ${filteredShops.length} shops`.

---

### 4 — Category navigation: remove `/category/:id`, redirect to `/shops?category=NAME`

This is the biggest routing change. Three files involved.

**`src/pages/Home.tsx` — category button `onClick`**

Change line ~495:
```diff
- onClick={() => navigate(`/category/${cat.id}`)}
+ onClick={() => navigate(`/shops?category=${encodeURIComponent(cat.name)}`)}
```

**`src/pages/Shops.tsx` — read `category` URL param**

Add to existing URL param reading at top:
```ts
const categoryParam = searchParams.get('category') || '';
```

Initialize `selectedCategories` from it:
```ts
const [selectedCategories, setSelectedCategories] = useState<string[]>(
  categoryParam ? [categoryParam] : []
);
```

This means when the user lands on `/shops?category=Grocery`, the category filter is pre-selected and results show immediately — no extra fetch, same data query.

**`src/App.tsx` — redirect old `/category/:id` route**

Keep the route but redirect to home instead of showing CategoryPage, so old links don't 404. Or better: add a redirect component that looks up the category name from the ID and redirects to `/shops?category=NAME`.

Actually cleanest: leave `/category/:id` as a redirect shim in App.tsx using a simple component that does a DB lookup then `navigate`:

```tsx
// In App.tsx or inline
function CategoryRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    supabase.from('categories').select('name').eq('id', id!).single()
      .then(({ data }) => {
        if (data?.name) navigate(`/shops?category=${encodeURIComponent(data.name)}`, { replace: true });
        else navigate('/shops', { replace: true });
      });
  }, [id]);
  return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">Loading...</div>;
}
```

This keeps backwards compatibility for any existing shared links, then redirects to the new URL.

`CategoryPage.tsx` file is kept as-is (not deleted) but the route now hits `CategoryRedirect` instead.

---

### No SQL changes needed

All `shops` table columns (`sub_area`, `description`, `keywords`, `opening_time`, `closing_time`) already exist per the schema. No migration required.

### No `.env` changes

Explicitly will not touch `.env`.

---

### Files changed

| File | Change |
|---|---|
| `src/components/admin/ShopsTab.tsx` | Expand CSV export to 16 fields |
| `src/components/admin/CsvImportModal.tsx` | Add sub_area, description, keywords to template + import |
| `src/pages/Home.tsx` | Category pagination (6/page, view more) + change nav to `/shops?category=` |
| `src/pages/Shops.tsx` | 10/page pagination + read `category` URL param to pre-select filter |
| `src/App.tsx` | Add `CategoryRedirect` shim for `/category/:id` backwards compat |
