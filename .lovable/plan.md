## Full Audit — What Already Exists

### Keep unchanged (do not rebuild):

- `ShopCard` component — full card with verified badge, call/WhatsApp/maps buttons, open/closed status — ✅ reuse as-is for all new sections
- `shops` query on Home page — fetches `*, shop_categories(category_id, categories(name, icon))` from active shops — ✅ **reuse same data, no new query needed** for featured + recently added sections (just derive from already-loaded `shops` array)
- `StatPill` component on Home — ✅ extend with verified count
- Trust strip (Direct calls / Verified listings / Local businesses) — ✅ keep, just enhance the stat pill row above it
- `CategorySkeleton` — ✅ reuse shimmer pattern for new sections
- Empty states on `Shops.tsx` and `CategoryPage.tsx` — exist but are minimal (no helpful action links beyond basic buttons)

### Gaps Phase 6 fills:

1. **Featured Verified Shops** — no homepage section for `is_verified = true` shops
2. **Recently Added** — no "new arrivals" section; `created_at` exists in schema and is already in loaded data
3. **Empty states** — Shops.tsx and CategoryPage.tsx have basic states but lack contextual cues (e.g., "No shops in Main Road" → suggest browse all / clear area / go home)
4. **Trust signals** — Stats row only shows total/open/categories count; verified count not shown; trust strip is static

---

## Phase 6 — Implementation Plan

### Files to change:

1. `src/pages/Home.tsx` — add Featured Verified + Recently Added sections, enhance stats, verified count pill
2. `src/pages/Shops.tsx` — improve empty state with contextual suggestions
3. `src/pages/CategoryPage.tsx` — improve empty state with contextual suggestions
4. `V2_DOC_CHANGES.md` — append Phase 6 section

**No new components file needed** — ShopCard is reused inline, new sections are self-contained in Home.tsx.
**No DB changes** — `is_verified` and `created_at` already exist in loaded shop data.

---

## Detailed Changes

### 1. `src/pages/Home.tsx`

#### a. Derive featured + recent from existing `shops` query (no new fetch)

```typescript
// All derived from already-loaded `shops` — zero extra network requests
const verifiedShops = useMemo(
  () => shops.filter((s: any) => s.is_verified)
             .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
             .slice(0, 6),
  [shops]
);

const recentShops = useMemo(
  () => [...shops]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5),
  [shops]
);
```

#### b. Featured Verified Section — placed between categories and View All CTA

- Conditional: only render if `verifiedShops.length > 0`
- Header: "✅ Verified Shops" + "View all →" link to `/shops` with verified filter pre-applied (use `?verified=true` query param — see note below)
- Uses **compact inline card** (not full ShopCard to keep homepage lightweight):
  - Small card: emoji icon + name + area + open/closed dot + Call/WA buttons
  - Horizontal scroll on mobile (`flex overflow-x-auto gap-3 scrollbar-none`)
  - Max 6 verified shops shown
  - "View all verified" link at end of scroll row
- No skeleton needed (data comes from same query as categories)

Note on "View all verified" link: `/shops` already has `verifiedOnly` filter in its state — pass `?filter=verified` query param and read it in `Shops.tsx` to pre-activate the verified filter on load.

#### c. Recently Added Section — placed after featured verified, before View All CTA

- Conditional: only render if `recentShops.length >= 3` (not interesting with fewer)
- Header: "🆕 Recently Added" + section subtitle
- Horizontal scroll row of compact cards (same compact style as verified section — reuse the same `CompactShopCard` inline component)
- Max 5 shops
- No "View all" link needed (all shops are reachable via existing CTA)

#### d. Stats row — add verified count pill

Current: `X Shops | Y Open Now | Z Categories`
New: `X Shops | Y Open Now | Z Categories | N Verified` (only show verified pill if `verifiedCount > 0`)

```typescript
const verifiedCount = useMemo(() => shops.filter((s: any) => s.is_verified).length, [shops]);
```

Add `ShieldCheck` icon import to the existing imports.

#### e. Trust strip update

Current: `Direct calls | Verified listings | Local businesses`
Improve: Change "Verified listings" to show dynamic count: `✓ {verifiedCount} Verified` when count > 0, else keep "Verified listings" as fallback. Keep the strip compact — no layout change.

---

### 2. `src/pages/Shops.tsx` — Empty State Improvements

Current empty state (line 316–349):

```
🔍/🌙/📍/🏷️
No shops found
Try adjusting your filters / Try a different search term
[Clear filters button] [Clear search button] [Go Home button]
```

Improve with contextual messaging per scenario:


| Scenario                     | Icon | Message                        | Actions                         |
| ---------------------------- | ---- | ------------------------------ | ------------------------------- |
| Search + no results          | 🔍   | `No shops match "{search}"`    | Clear search, Browse all        |
| Open only filter             | 🌙   | "No shops open right now"      | Show all shops, Clear filter    |
| Area filter + no results     | 📍   | `No shops found in {area}`     | Clear area filter, View all     |
| Category filter + no results | 🏷️  | `No shops in this category`    | Browse categories, Clear filter |
| Verified only + no results   | ✅    | "No verified shops yet"        | View all shops                  |
| Combo filter                 | 🔍   | "No shops match these filters" | Clear all filters               |
| Completely empty (no data)   | 🏪   | "No shops listed yet"          | Go Home                         |


Implementation: replace the single generic empty state block with a `getEmptyState()` helper that returns `{ icon, title, body, actions[] }` based on current filter state. Render more specific action buttons.

Also: when `localSearch` has no results, add a "Browse by category" button that navigates to `/` — this gives users a discovery escape hatch.

---

### 3. `src/pages/CategoryPage.tsx` — Empty State Improvements

Current (line 224–249):

```
🌙/📍/🏪
No shops found
Try adjusting your filters / No shops in this category yet
[Clear filters / Go Home]
```

Improve:

- When `activeFilterCount > 0`: "No {categoryName} shops match your filters" + Clear filters + "View all {categoryName}" (clears filters only, keeps category)  
- When no active filters (category just has no shops): "No {categoryName} shops listed yet" + "Browse other categories" → navigate to `/`) + "View all shops" → navigate to `/shops`)
- Pass category name into the message so it reads naturally: "No Grocery shops match your filters"

---

### 4. `V2_DOC_CHANGES.md` — append Phase 6 section

Document all changes, what was kept, what was deferred.

---

## Key Design Decisions

**Compact card for homepage sections** (not full ShopCard):

- Full ShopCard is rich (image, multiple buttons, times) — too heavy for a horizontal scroll on homepage
- Compact card: `rounded-xl border bg-card p-3 w-[200px] shrink-0` with name, area, open dot, single Call button
- Reuses same styling tokens, not a new design system

**No new queries on Home**:

- All derived via `useMemo` from the existing `shops` query — zero extra network requests
- `created_at` is already in the shops table and returned by the existing `select('*')` query

`**?filter=verified` on Shops page**:

- Shops.tsx reads `searchParams` already (for `search` param)
- Add: `const filterParam = searchParams.get('filter'); const [verifiedOnly, setVerifiedOnly] = useState(filterParam === 'verified');`
- This lets the "View all verified" link from Home pre-activate the verified filter

**Graceful hiding**:

- Featured Verified: hidden if `verifiedShops.length === 0`
- Recently Added: hidden if `recentShops.length < 3`
- Verified count StatPill: hidden if `verifiedCount === 0`

---

## **This plan is good. Proceed, with these refinements:**

1. Keep homepage compact cards lightweight, but do not make them too weak:

   - shop name

   - area

   - verified indicator if relevant

   - open/closed cue if easy

   - card should be clickable to shop detail

   - include at least one clear quick-contact action

   - if space allows, prefer both Call and WhatsApp over only Call

2. For Recently Added, do not surface low-quality entries. Prefer active shops with enough basic data to feel useful.

3. Implement the verified filter on `/shops` cleanly:

   - support preselection from query param

   - allow normal user interaction after load

   - do not make filter state brittle

4. Keep homepage sections compact and performant.

   Do not let Featured Verified and Recently Added make the homepage feel heavy on mobile.

5. In empty states, keep action buttons limited and useful.

   Prefer 1–2 strong next steps instead of too many choices.

&nbsp;

## Section Order on Home (after changes)

```text
[Hero Header + Search + Stats]
[Trust Strip]
[Browse by Category]          ← unchanged
[Featured Verified Shops]     ← NEW (hidden if 0 verified)
[Recently Added]              ← NEW (hidden if < 3 shops)
[View All Shops CTA]          ← unchanged
[List Your Shop CTA]          ← unchanged
[Quick Info]                  ← unchanged
[Footer]


```