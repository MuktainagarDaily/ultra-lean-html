
## Full Design & Mobile Responsive Audit — All Pages

### Issues Found Per Page

---

#### 1. `Home.tsx` — Minor issues
- **Trust strip** on mobile scrolls horizontally but has no fade-out hint — user may not know there's more content
- **CompactShopCard** horizontal scroll row: cards are `w-[185px]` fixed — on very small screens (320px) this looks cramped
- **"List Your Shop"** CTA button sits very close to Quick Info box below it — needs a bit more breathing room
- **Stats pills row**: can wrap awkwardly on very small screens; pills have no `shrink-0` protection on some breakpoints
- **Search input**: `pr-[88px]` hard-coded right padding for the Search button — on very small screens (360px) the button text may clip

---

#### 2. `Shops.tsx` — Issues
- **Header is very tall** on mobile — has sticky header with search bar + filter bar. The vertical stacking makes it take ~130px+. Filter pills row has no visible scroll fade hint.
- **Filter pills** in header: active filter pills that overflow horizontally have no visual fade to indicate scrollability
- **ShopSkeleton**: `h-10` action bar at the bottom is slightly too short to match real `min-h-[44px]` buttons
- **Search clear button** `X` — very small tap target (just the icon, no padding around it)
- **Drawer filter**: category section missing from `CategoryPage` drawer (it's in `Shops.tsx` but `CategoryPage.tsx` doesn't have it — consistent, just noting). The `Verified Only` checkbox in the drawer has no visible checkbox icon, just a radio-button-style toggle.

---

#### 3. `CategoryPage.tsx` — Issues
- **Header**: filter bar is directly after title row without a search bar — on a category page with many shops, no search is available
- **Empty state** in `isError`: missing the descriptive "Check your connection" sub-text that `Shops.tsx` has — less helpful
- **Drawer**: max-h is `75vh` which is fine, but on iPhone SE (375px) with the keyboard open it could get cut off
- **Filter pill row**: same horizontal overflow issue as Shops, no fade

---

#### 4. `ShopDetail.tsx` — Issues
- **Image height** `h-52` (208px) — on 320px screens this is 65% viewport height before any content, pushing the action buttons far below
- **Coordinates DetailRow**: showing raw lat/lng coordinates to end users is unnecessary and confusing — should be removed or replaced with an "Open in Maps" link only
- **Detail card**: when `address` AND `area` are both set, two separate `MapPin` rows appear — visually repetitive; should combine into one row
- **Action buttons section**: when a shop has no phone but has WhatsApp, the WhatsApp button renders alone at full width — looks fine. But when ONLY maps URL exists (no phone, no WA), the Maps button is isolated and the Share button follows — inconsistent spacing.
- **"Share this shop" button**: very plain `border-border` styling — low visual hierarchy

---

#### 5. `ShopCard.tsx` — Issues  
- **Maps button** (blue pin icon): when all 3 buttons (Call, WA, Maps) are present, the maps button is icon-only `px-3` while others are `flex-1` — creates uneven layout on small screens
- **Image strip** `h-28 sm:h-32` — slightly too short, content feels squished in the card
- **Verified badge**: renders inside the name flex row but with `flex-wrap` it can drop to a new line, creating an orphaned line — needs better handling
- **Category chips**: using `text-[10px]` which is below 11px accessibility minimum for readability

---

#### 6. `RequestListingModal.tsx` — Issues
- **Mobile full-height form**: uses `fixed inset-0 overflow-y-auto py-4 px-4` — on iOS Safari the bottom nav bar eats into viewport and the bottom Cancel button can be hidden behind it. Need `pb-safe` or `pb-20` at the form bottom.
- **Image upload field**: raw `<input type="file">` has no visible button styling — looks broken on mobile (just shows "Choose File" text inline with no styling)
- **Progress sections**: the form has 8+ fields but no visual grouping sections/dividers (except the location box) — walls of form fields feel overwhelming
- **Location section error**: `errors.location` paragraph sits `-mt-2` outside the box — can overlap with adjacent content
- **Time fields**: `grid-cols-2` with `type="time"` — on iOS, the native time picker can be hard to use in a cramped 2-column layout

---

#### 7. `AdminDashboard.tsx` — Issues
- **Stats grid**: `grid-cols-2 xs:grid-cols-3 sm:grid-cols-5` — `xs` is not a Tailwind default breakpoint, it won't work. Falls back to 2 columns on mobile, making 5 cards display as 2+2+1 with the last card oddly alone
- **Tab row**: 5 tabs in a horizontal scroll row — on mobile, active tab is not always visible. No visual indicator of scrollability.
- **ShopModal save button row**: `flex gap-3` Cancel + Save — on mobile both are `flex-1 py-3` which is fine, but the modal itself has `max-h-[calc(100dvh-2rem)]` — the overflow scroll inner form can get stuck in some mobile browsers
- **Admin header user email**: hidden until `xl` breakpoint — on tablet it's not visible at all

---

### Plan: Fix All Issues

#### Files to change:
1. **`src/index.css`** — add `scrollbar-none` utility (already used but may need explicit `ms-overflow-style` + `scrollbar-width` for cross-browser), add `.scroll-fade-right` utility class for horizontal scroll fade hints, add `pb-safe` utility
2. **`src/pages/Home.tsx`** — fix CompactShopCard min-width on xs screens, add `shrink-0` to stat pills
3. **`src/pages/Shops.tsx`** — fix search clear button tap target, improve filter pills scroll fade
4. **`src/pages/CategoryPage.tsx`** — add error sub-text to isError state
5. **`src/pages/ShopDetail.tsx`** — remove lat/lng coordinates row (replace with direct Maps link in DetailRow), combine address+area into one row, reduce image height on mobile, improve Share button styling
6. **`src/components/ShopCard.tsx`** — make maps button `flex-1` with text label "Maps", fix `text-[10px]` → `text-[11px]`, improve image height slightly
7. **`src/components/RequestListingModal.tsx`** — fix iOS safe area bottom, style the file input as a proper upload button, add section dividers (Personal Info / Location / Hours / Photo), fix location error margin, improve time field layout on mobile
8. **`src/pages/AdminDashboard.tsx`** — fix `xs:` breakpoint → use `min-[480px]:` Tailwind arbitrary breakpoint syntax, fix stats grid to show properly on all screens

### Grouped changes by file:

**`src/index.css`**
- Add explicit `scrollbar-none` cross-browser styles (already used everywhere)
- Add `pb-safe` utility for iOS safe area

**`src/pages/ShopDetail.tsx`**
- Remove `Coordinates` DetailRow (clutters UX for end users)
- Merge `address` + `area` into a single row: "address, area" or show both inline
- Reduce image to `h-40 sm:h-52` 
- Improve Share button to use accent styling

**`src/components/ShopCard.tsx`**  
- Maps button: add `flex-1` + "Maps" label text so it matches Call/WA width
- `text-[10px]` category chips → `text-[11px]`
- Image height `h-28 sm:h-32` → `h-32 sm:h-36`

**`src/components/RequestListingModal.tsx`**
- Bottom of form: `pb-6` → `pb-10 sm:pb-6` for iOS safe area
- File input: wrap in styled upload button UI
- Add visual section headers (shop info / location / schedule / photo / submitter) with light divider lines
- Fix `errors.location` margin: `-mt-2` → `mt-1.5`

**`src/pages/AdminDashboard.tsx`**
- Stats grid: `xs:grid-cols-3` → `min-[480px]:grid-cols-3` (valid Tailwind arbitrary)

**`src/pages/Home.tsx`**
- `StatPill`: add `shrink-0` to prevent wrapping issues

**`src/pages/Shops.tsx`** & **`src/pages/CategoryPage.tsx`**
- Search clear button: wrap `X` icon in `p-2` for 44px tap target
- Add error sub-text to CategoryPage error state

---

### What NOT to change
- Core data fetching, business logic, color scheme, font system — all solid
- The location UI (Maps link + GPS) — just implemented and works well
- Admin tabs layout — functionally correct, just the `xs:` breakpoint fix needed
