# V1_DOC_CHANGES.md — Polish Pass Changes

> Generated: March 2026  
> Scope: V1 polish pass — data quality, admin UX, search quality, copy consistency

---

## Changes Made

### 1. Phone & WhatsApp Normalization

**What changed in code:**
- Added `isValidPhone()` validation — blocks save if phone has fewer than 10 digits
- Added WhatsApp validation — warns if WhatsApp number is provided but has fewer than 10 digits
- Added `normalizeWhatsApp()` — on save, WhatsApp is stored as digits-only with `91` country code prefix (e.g. `919876543210`), ensuring `wa.me` links always work correctly
- `ShopCard` and `ShopDetail` now compute the wa.me number from stored value without raw `.replace(/\D/g,'')` inline — handled at save time and normalized at display time
- Image `onError` handler added to `ShopCard` and `ShopDetail` — broken image URLs hide the image and keep card layout stable

**DOCUMENT.md update (Business Logic > Phone Normalization):**
Added note that WhatsApp numbers are normalized to digits-only with `91` country code on save. Also added `normalizeWhatsApp()` to the documented function inventory.

---

### 2. Admin Search — Extended to address field

**What changed in code:**
- Admin shops search (`ShopsTab`) now also matches `address` and `whatsapp` digit substring in addition to `name`, `area`, `phone`
- Placeholder updated to "Search name, area, phone, address..."

**DOCUMENT.md update (Admin Panel > Shops Tab):**
- "Search by name, area, or phone" → "Search by name, area, address, or phone"

---

### 3. Public Search — Extended to address field

**What changed in code:**
- `Shops.tsx` Supabase query now searches `name`, `area`, `address` via `ilike`
- Numeric-only input triggers phone/WhatsApp digit search instead
- Placeholder updated to "Search by name, area, address..."

**DOCUMENT.md update (Public Site > Shop Listing):**
- "search by name/area/phone" → "search by name, area, address (DB ilike); phone digit match for numeric queries"

---

### 4. Admin Form UX Improvements

**What changed in code:**
- Phone and WhatsApp `placeholder` changed from `+91 9876543210` to `e.g. 9876543210` (cleaner, consistent with Indian plain-number input)
- `inputMode="numeric"` added to phone and WhatsApp inputs for mobile keyboard
- WhatsApp field now labeled "WhatsApp (optional)" with hint "Leave blank if same as phone"
- Address field label changed from "Address" to "Address (Street / Full address)" for clarity
- Area field `placeholder` updated to "e.g. Main Road, Muktainagar"
- Area field now has a `<datalist>` with common Muktainagar area suggestions (Main Road, Station Road, Bus Stand Area, Market Area, Ward 1–5) — admin can type freely or pick a suggestion
- Area value is title-cased on save (e.g. "main road" → "Main Road") for consistent display

**DOCUMENT.md update (Admin Panel > Shop Form):**
- Added note: "Area is title-cased on save; common area suggestions provided via datalist"

---

### 5. Image Fallback

**What changed in code:**
- `ShopCard`: `useState(false)` for `imgError`; `onError={() => setImgError(true)}` on `<img>`; image section hidden when `imgError = true`
- `ShopDetail`: same pattern — `imgError` state moved before early returns (React hooks rule); broken image hides gracefully

**DOCUMENT.md update (Public Site > Shop Listing):**
- Added: "broken image URLs fail gracefully — card/detail layout stays stable"

---

## Verified Unchanged — Still True

| Claim | Status |
|---|---|
| Analytics tab — 3 summary cards + ranked table + empty state | ✅ unchanged |
| `shop_engagement` RLS — public INSERT, authenticated SELECT | ✅ unchanged |
| `logEngagement` fire-and-forget | ✅ unchanged |
| Inactive shop 🔒 guard in ShopDetail | ✅ unchanged |
| Duplicate phone detection + self-exclusion on edit | ✅ unchanged |
| Category is optional (no validation enforced) | ✅ unchanged |
| Lat/lng range validation | ✅ unchanged |
| AlertDialog for shop and category deletes | ✅ unchanged |
| Hero gradient, trust strip, Marathi placeholder, FAB | ✅ unchanged |
| Auto-refresh every 60s (Shops + CategoryPage) | ✅ unchanged |
