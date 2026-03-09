## Full Audit Results — What Exists vs. What to Build

### Already correct (skip):

- Home.tsx WhatsApp 091 normalization — already fixed (lines 33–35)
- ShopDetail `.eq('is_active', true)` — already in place (line 30)
- pendingCount independent query — already in RequestsTab (lines 55–64)
- Filter sheet on Shops.tsx — fully implemented with Drawer + area/category/availability/verified filters
- Filter sheet on CategoryPage.tsx — implemented with area/availability filters
- PWA manifest — has name, short_name, theme_color, icons
- og:title, og:description, og:image, twitter:card — all present in index.html
- Admin monolith — already split into 10 files
- All RISK-01 through RISK-10 items — resolved

### Real gaps found during audit:

**1. Homepage search bar — no inline filter option (user requirement #5)**
The search bar on Home.tsx only does text search then navigates to `/shops`. There is no way to pre-select a category from the homepage search. The request was specifically "add filter option in homepage search bar." The most useful implementation: add a category chip-strip directly below the search bar on the homepage (no extra modal needed — just a horizontal scrollable row of category pills, clicking one navigates to `/category/:id`). This is fast, usable, and zero-risk.

**2. SEO — per-page `<title>` and `<meta description>` are static**
`index.html` has a fixed title ("Muktainagar Daily — Local Business Directory") for every page. ShopDetail, CategoryPage, Shops — they all share the same title. Google's and WhatsApp's crawler only read what's in the initial HTML (this is client-side React, no SSR), but we can use `document.title` updates via `useEffect` in each page component — this helps browser tab labeling, "back button" tab names, and serves users with bookmarks. It costs nothing performance-wise.

**3. PWA manifest — missing `screenshots`, `categories`, and `display_override**`
The manifest lacks:

- `categories: ["local", "business", "shopping"]` — used by browser install prompts
- `display_override: ["standalone", "browser"]` — improves install prompt eligibility
- `lang: "mr"` — signals Marathi primary language to search engines and crawlers
These are safe manifest-only additions, zero JS changes.

**4. Admin: ShopsTab has no "jump to shop detail" quick link**
When reviewing a shop in the admin table, there's no way to open the public shop page to see exactly what users see. The edit button opens the edit modal, but sometimes the admin just wants to preview. A tiny external-link icon button per row linking to `/shop/:id` would save significant time.

**5. Admin: RequestsTab — no "admin notes" field visible or editable**
The DB schema has `admin_notes: string | null` on `shop_requests`, and it's displayed as part of the request record in the view detail modal... actually checking — it's NOT shown in the view modal (lines 319–336 only show: phone, whatsapp, area, address, category, opening, closing, submitter_name, submitted_on). So admin notes from the DB are silently discarded in the UI. Adding a small read-only notes field (or even an editable one) in the view modal would let admins leave notes on requests before approving/rejecting.

**6. index.html — missing `<meta name="robots">` and canonical link**
No `robots` meta tag. No canonical URL `<link rel="canonical">`. These are 2-line SEO additions.

**7. Home page — document.title is static for every page**
ShopDetail should update `document.title` to `{shop.name} — Muktainagar Daily` when the shop loads. CategoryPage should set `{category.name} Shops — Muktainagar Daily`. These matter for browser tabs and PWA history. Can use `useEffect` with `document.title`.

**8. Admin: AnalyticsTab missing "No data" zero-engagement period handling**
When date range shows 0 taps AND the query has finished loading, the UI shows "No engagement data for this period" — this is fine. Skip.

**9. PWA: `theme-color` meta matches but `apple-mobile-web-app-capable` missing**
For iOS full-screen PWA behavior, `<meta name="apple-mobile-web-app-capable" content="yes">` and `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` improve iOS install behavior. These are 2 meta tags in index.html.

**10. Home page search — no keyboard shortcut (skip, premature)**

---

## Plan: What to Implement

### A. Homepage: Category filter chips below search bar (Priority #5)

In `src/pages/Home.tsx`, below the search form but above the Stats Row, add a horizontally scrollable row of active category chips. Each chip shows the category icon + name and navigates to `/category/:id` on click. Uses the already-loaded `sortedCategories` data — zero extra queries. Show at most 6 chips to avoid cluttering the hero; a "More →" chip at the end navigates to `/shops`.

This directly satisfies user requirement #5 ("add filter option in homepage search bar") in a mobile-first, low-risk way.

### B. Dynamic `document.title` per page

`useEffect(() => { document.title = '…'; return () => { document.title = 'Muktainagar Daily'; }; }, [dep])` in:

- `ShopDetail.tsx`: `{shop.name} — Muktainagar Daily`
- `CategoryPage.tsx`: `{category.icon} {category.name} Shops — Muktainagar Daily`  
- `Shops.tsx` (search): when `debouncedSearch` is set → `"{search}" — Muktainagar Daily`

### C. SEO polish in `index.html`

Add:

```html
<link rel="canonical" href="https://muktainagar-daily.lovable.app" />
<meta name="robots" content="index, follow" />
<meta name="geo.region" content="IN-MH" />
<meta name="geo.placename" content="Muktainagar, Jalgaon, Maharashtra" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Muktainagar" />
```

### D. PWA manifest polish

Add `categories`, `display_override`, and `lang` to `public/manifest.json`:

```json
"lang": "mr",
"categories": ["local", "business", "shopping"],
"display_override": ["standalone", "browser"]
```

### E. Admin: Quick "Preview" link in ShopsTab

In `src/components/admin/ShopsTab.tsx`, in the actions column per row, add an `<a href="/shop/{shop.id}" target="_blank">` button with an `ExternalLink` icon. One icon, zero state, zero DB calls.

### F. Admin: Admin notes display in RequestsTab view modal

In `src/components/admin/RequestsTab.tsx`, inside the view detail modal's field list (lines 319–336), add `admin_notes` to the displayed fields array. It is already in the `ShopRequest` interface and the DB row. Purely additive, 1 line.

REMBER DONT BREAK CODE,APP, destabilizing app

---

## Files to Change


| File                                   | Change                                          | Risk                |
| -------------------------------------- | ----------------------------------------------- | ------------------- |
| `src/pages/Home.tsx`                   | Add category quick-filter chips below search    | Low — additive only |
| `src/pages/ShopDetail.tsx`             | `useEffect` to set `document.title`             | Zero                |
| `src/pages/CategoryPage.tsx`           | `useEffect` to set `document.title`             | Zero                |
| `src/pages/Shops.tsx`                  | `useEffect` to set `document.title` for search  | Zero                |
| `index.html`                           | Add robots, canonical, geo, apple PWA meta tags | Zero                |
| `public/manifest.json`                 | Add lang, categories, display_override          | Zero                |
| `src/components/admin/ShopsTab.tsx`    | Add external preview link per row               | Low                 |
| `src/components/admin/RequestsTab.tsx` | Show admin_notes in view modal                  | Zero                |


---

## What Is Intentionally Skipped

- **Server-Side Rendering / dynamic OG images per shop**: Would require a backend rendering solution, far outside scope
- **Admin notes editing**: The field exists in DB; making it editable would require a mutation — deferred as a separate task
- **PWA screenshots**: Requires actual device screenshots, design work
- `**<html lang="mr">` in index.html**: The app is bilingual (English + Marathi). Setting lang to "mr" would misclassify English text. Left as "en"
- **localStorage filter persistence on homepage**: No clear user need stated, adds complexity
- **Keyboard shortcut for search**: Premature at this scale
- **Category filter inside the actual search input box**: Would require a combobox UI overhaul — the chip strip below search achieves the same goal more simply on mobile