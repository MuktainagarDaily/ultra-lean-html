# V1_DOC_CHANGES.md — DOCUMENT.md Audit Corrections

> Generated: March 2026  
> Audit scope: Full codebase verification against DOCUMENT.md claims  
> Method: Direct inspection of `Home.tsx`, `AdminDashboard.tsx`, `ShopDetail.tsx`, migration SQL, and supabase types

---

## Changes Made

### Section: Key Features — V1 > Homepage (`Home.tsx`)

**Old wording:**
> Search bar — prominent, full-width; placeholder in Marathi (`दुकान, सेवा किंवा भाग शोधा…`); focus ring on tap

**New wording:**
> Search bar — prominent, full-width; placeholder in Marathi (`दुकान, सेवा किंवा भाग शोधा…`); focus ring animates on tap (standard browser focus; no programmatic auto-focus implemented)

**Reason for change:**  
`Home.tsx` defines `searchRef = useRef<HTMLInputElement>` and wires `onFocus`/`onBlur` handlers to animate the search icon colour — but there is no `useEffect` or event handler that calls `searchRef.current?.focus()` programmatically. The phrase "auto-focuses on mobile tap" implied deliberate programmatic focus, which does not exist. The ref is used purely for the icon animation. Standard browser tap-to-focus behaviour applies.

---

## Verified True — No Change Required

The following documented claims were inspected and confirmed accurate:

| Claim | Verified In |
|---|---|
| Analytics tab with 3 summary cards (Total Taps, Calls, WhatsApp) | `AdminDashboard.tsx` lines 609–728 |
| Ranked engagement table sorted by total desc | `AdminDashboard.tsx` line 636 |
| Empty state when no analytics data | `AdminDashboard.tsx` lines 672–677 |
| `shop_engagement` table — correct columns (id, shop_id, event_type, created_at) | `types.ts` + migration SQL |
| Indexes on `shop_id`, `event_type`, `created_at` | Migration `20260308081815_*.sql` |
| RLS: public `INSERT = true`, authenticated-only `SELECT` | Migration SQL confirmed |
| `logEngagement` fire-and-forget; never blocks tap action | `ShopDetail.tsx` lines 8–15 |
| Call button fires `logEngagement('call')` | `ShopDetail.tsx` line 237 |
| WhatsApp button fires `logEngagement('whatsapp')` | `ShopDetail.tsx` line 250 |
| Hero section: 145deg gradient, grid texture overlay, decorative blobs | `Home.tsx` confirmed |
| Trust strip with Phone / Star / MapPin icons | `Home.tsx` lines 172–191 |
| Stats pills (total shops, open-now, category count) | `Home.tsx` lines 158–168 |
| Category grid sorted by shop count descending | `Home.tsx` lines 68–75 |
| WhatsApp FAB with Marathi label | `Home.tsx` lines 277–288 |
| Inactive shop `/shop/:id` shows 🔒 unavailable state; data not exposed | `ShopDetail.tsx` lines 87–101 |
| Active shops filtered client-side with `.eq('is_active', true)` on listing pages | `Shops.tsx`, `CategoryPage.tsx` |
| No `window.confirm()` / `window.alert()` / `window.prompt()` in codebase | Full codebase search: 0 matches |
| AlertDialog for shop delete | `AdminDashboard.tsx` lines 395–418 |
| AlertDialog for category delete with scrollable linked shop list | `AdminDashboard.tsx` lines 556–604 |
| Duplicate phone blocks save; shows name, phone, area, category pills | `AdminDashboard.tsx` lines 1101–1163 |
| Phone normalisation: strips spaces, dashes, parens, `+`; strips `91` prefix from 12-digit numbers | `AdminDashboard.tsx` lines 735–739 |
| Duplicate check excludes self on edit (`s.id !== shop.id`) | `AdminDashboard.tsx` line 912 |
| Lat range validation: -90 to 90 | `AdminDashboard.tsx` lines 804–808 |
| Lng range validation: -180 to 180 | `AdminDashboard.tsx` lines 809–811 |
| Name required; phone required; area OR address required | `validate()` function confirmed |
| Category is NOT required (optional; save never blocked for missing category) | `validate()` has no category check — DOCUMENT.md correctly omits "Category — required" |
| `updated_at` trigger on `shops` and `categories` | Migration SQL + network response shows timestamps updating |

---

## Note on "Category required" claim

The audit instruction anticipated that DOCUMENT.md might incorrectly state "Category — required" in the Shop Form Validation section. **This entry does not appear in the current DOCUMENT.md** — it was either never written or was already removed in a prior edit. No correction was needed for this item.
