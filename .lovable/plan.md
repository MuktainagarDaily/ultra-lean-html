
## Full Audit Findings + Admin Mobile Responsiveness Plan

### Bugs & Issues Found

**1. Stats bar — `grid-cols-5` breaks on small screens (AdminDashboard)**
Line 91: `grid grid-cols-5 gap-3` — 5 equal columns on a 320px phone = each card ~55px wide, text truncates and overflows. No responsive breakpoint defined.

**2. Tabs row overflow — no minimum shrink (AdminDashboard line 101)**
`flex gap-2 mb-5 overflow-x-auto` — tabs have no `shrink-0` so they squish awkwardly before triggering scroll. Also tab labels ("Data Quality") wrap weirdly at small widths.

**3. ShopModal — `grid grid-cols-2` Phone/WhatsApp fields too narrow on mobile (line 2049)**
Two-column input grid becomes ~130px per field on a 320px screen. Needs to collapse to 1 column on xs.

**4. ShopModal — `fixed inset-0 overflow-y-auto` with inner div can cause nested scroll glitch on iOS Safari**
The modal uses a raw `fixed` overlay with `overflow-y-auto py-4 px-4` and an inner `my-4` div. On iOS this causes rubber-band double-scroll. Needs `overscroll-contain` and safer height handling.

**5. CsvImportModal — same iOS scroll glitch, even bigger on mobile since modal is `max-w-3xl`**
On a phone a 3xl-wide modal is fine for horizontal scroll but the inner table `overflow-x-auto` and outer `overflow-y-auto` clash.

**6. RequestsTab — view request detail modal has same `fixed inset-0 overflow-y-auto` issue**
Line 2601 — identical pattern.

**7. CategoryMergeModal / ShopModal — `DialogContent` from Radix has `max-w-lg` by default, fine on desktop but no scroll guard on short iOS screens**
If content exceeds viewport, Radix dialog content overflows. Adding `max-h-[90vh] overflow-y-auto` to the DialogContent wrapper fixes this.

**8. Admin top-bar: user email hidden at `md:` but no ellipsis fallback on tablet causing layout shift**
Line 77: `hidden md:block truncate max-w-[140px]` — acceptable but on 768px tablets this shows mid-text and can push sign-out button off screen if email is long.

**9. `grid-cols-3` analytics summary cards (line 1015) — fine, stays 3 columns but cards are very tight on 320px phones (text can overflow). Minor but visible.**

**10. Storage audit section (lines ~1400-1728) — `DataQualityTab` has a hidden internal `StorageAuditSection` sub-component that uses `useQuery` but the component doesn't show a loading spinner for the audit scan, just a button. The refetch on-demand is fine but the loading state during scan is not shown per the code pattern — low severity.**

**11. Shops tab table — "Verified" column hidden at `hidden lg:table-cell` (line 381) — on tablet this data is invisible and there's no way to verify without clicking edit. On mobile the Active toggle and Actions are the only visible columns. On very small screens Actions buttons can overlap. Low severity but UX gap.**

**12. `Home.tsx` — shops query uses a static empty string queryKey `['shops', 'all', '']` (line 127). If Shops.tsx has a different query `['shops', 'all', debouncedSearch]`, they share the same cache key only when search is empty, which is correct. No bug, but worth noting.**

**13. `CategoryPage.tsx` — `useEffect` dependency array at line 56 is `[filterOpen]` but references `availability` and `selectedAreas` — this is intentional (sync on open) but the lint warning is real. Minor.**

**14. `ShopCard.tsx` — not read yet, minor.**

### What Will Be Fixed

#### Admin Mobile Responsiveness (main focus)
1. **Stats bar**: `grid-cols-2 sm:grid-cols-5` — 2 per row on mobile, 5 on sm+
2. **Tabs**: Add `shrink-0` to all tab buttons, shorten "Data Quality" → "Quality" on mobile with responsive label
3. **ShopModal phone/WA grid**: `grid-cols-1 sm:grid-cols-2` 
4. **All 3 custom modals** (ShopModal, CsvImportModal, RequestDetail): Add `overscroll-contain` + `max-h-[calc(100dvh-2rem)]` to the modal container so they don't double-scroll on iOS
5. **CategoryMergeModal / CategoryModal** (Radix Dialog): Add `overflow-y-auto max-h-[calc(100dvh-4rem)]` to form container
6. **Admin top-bar email**: `hidden xl:block` instead of `md:block` to avoid layout pressure on tablets
7. **Shops table**: On mobile show status toggle inline in the shop name cell (move "Active" badge to the shop name row) so actions are less crowded

#### Bug Fixes (public pages)
8. **ShopDetail `waNumber`**: The inline IIFE to compute `waNumber` should also handle 12-digit numbers (with `91` prefix already) — currently if `shop.whatsapp = "919876543210"` it prepends another `91` → `91919876543210`. Fix the normalization to match the existing `normalizeWhatsApp` helper.
9. **Home.tsx** stats row: when `shops.length === 0` the stats pills row is hidden — fine. But `openNowCount` can be 0 when shops first load and flicker to correct number — no structural fix needed, just cosmetic.

### Files to change
- `src/pages/AdminDashboard.tsx` — main work: stats grid, tabs, modal scroll safety, phone grid, email truncation
- `src/pages/ShopDetail.tsx` — waNumber normalization bug fix

### Implementation sequence
1. Fix `ShopDetail.tsx` waNumber bug
2. Fix `AdminDashboard.tsx` — stats grid responsive
3. Fix tabs — shrink-0 + mobile label
4. Fix ShopModal phone/WA grid cols
5. Fix all 3 custom modals — iOS scroll / height safety
6. Fix Radix Dialog modals — overflow scroll
7. Fix admin header email breakpoint
