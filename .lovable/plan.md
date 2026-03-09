
## Summary of changes needed

### 1. `AdminDashboard.tsx` — ShopModal location section (lines 2101–2123)
Currently the admin ShopModal has plain number inputs for lat/lng plus a "find on Google Maps" hint link. Replace this entirely with the same rich location UI from `RequestListingModal`:

**New state to add to ShopModal (inside the component):**
- `mapsLinkInput` — raw paste text
- `mapsLinkError` — validation error
- `parsedPreview: { lat, lng, rawUrl } | null` — pending confirmation
- `locating` — GPS loading state
- `mapsLink` — confirmed stored link

**New helpers to add at the top of AdminDashboard (module-level, near `normalizePhone`):**
- `parseGoogleMapsLink(url)` — copy from RequestListingModal (same function)
- `handleGetLocation` — navigator.geolocation same as RequestListingModal

**Form state** — already has `latitude` and `longitude`. Add `maps_link` to `form` state or keep it as a separate `useState` (separate is cleaner, same as client modal).

**Save payload** (lines 1908–1909) — already saves `latitude` and `longitude`. Add `maps_link: mapsLink || null` since the `shops` table does NOT have a `maps_link` column. Wait — the `shops` table doesn't have `maps_link`. Only `shop_requests` does. So for the admin ShopModal, we save lat/lng only (no maps_link needed on the shops table). The maps link is just a UX aid. OK, so `mapsLink` state is only used during input and used to populate the "Verify on Maps" link in the confirm card — nothing extra needed in DB.

**New location section UI** — replaces lines 2101–2123 with the same card pattern: confirmed coords badge + paste link input + extract button + confirm preview card + divider + GPS button.

Need to import `Navigation`, `Link2`, `ExternalLink` — check existing imports:
- `Navigation` — NOT currently imported. Need to add.
- `Link2` — NOT currently imported. Need to add.
- `ExternalLink` — NOT currently imported. Need to add.

Current imports line 7 has `MapPin` already. Just need to add `Navigation`, `Link2`, `ExternalLink` to the lucide import.

### 2. `RequestListingModal.tsx` — Address field mandatory

Currently:
- `Field label="Address (Street / Landmark)"` — no asterisk, no validation (lines 385–394)
- Validation only checks `!form.area.trim() && !form.address.trim()` together (either area OR address required)

Change needed:
1. Make `address` field required on its own — add validation `if (!form.address.trim()) errs.address = 'Address is required'`
2. Remove the combined area+address check (or keep area still optional but address mandatory)
3. Change label to `"Address (Street / Landmark) *"` — remove the optional marker
4. Add error display `{errors.address && ...}` below the address input
5. Keep Area / Locality still optional (since address is now the mandatory one), OR keep both required — the user said "make address compulsory" so just address becomes required. Area stays `*` optional since it has its own `*` marker already. Actually looking at the current code:
   - Address: no `*`, no validation
   - Area: has `*`, validated via combined check
   
   User wants address to be required. I'll make address required independently and keep area optional (remove the `*` from area label or keep it — let's remove since address alone covers location).

   Actually re-reading: "make it compulsary to have address in listing form and remove option mark on it" — this means remove the "(optional)" styling from the address field and make it required. Area can stay as-is.

### Files to change
- `src/pages/AdminDashboard.tsx` — add `parseGoogleMapsLink` helper, add `Navigation`, `Link2`, `ExternalLink` imports, replace ShopModal location section with full Maps link + GPS UI
- `src/components/RequestListingModal.tsx` — make address field required (label, validation, error display)

### Exact line changes

**AdminDashboard.tsx:**
1. Line 7: Add `Navigation`, `Link2`, `ExternalLink` to lucide imports
2. After line ~1765 (after `isValidPhone`): Add `parseGoogleMapsLink` function
3. Inside `ShopModal` component after existing state (around line 1800): Add `mapsLinkInput`, `mapsLinkError`, `parsedPreview`, `locating`, `mapsLink` state + `handleGetLocation`, `handleExtractFromLink`, `confirmLocation`, `clearLocation` handlers + `hasCoords` derived variable
4. Lines 2101–2123: Replace the location section with the new rich UI card

**RequestListingModal.tsx:**
1. Lines 151–153 (validation): Replace combined area+address check with individual address required check
2. Lines 385–394 (address field): Update label to `Address *`, add `border-destructive` class on error, add error paragraph
