
## Plan: Google Maps Link → Coordinate Extraction in Listing Form

### Problem
Mobile users find GPS location capture unreliable (permission prompts, poor accuracy indoors). The new flow: user opens Google Maps, taps Share → copies the link, pastes it into the form. The app parses the coordinates from the link and shows a preview for confirmation.

### What needs to change

#### 1. Database migration — add columns to `shop_requests`
The `shop_requests` table currently has no location columns. Need to add:
- `latitude double precision` — nullable
- `longitude double precision` — nullable  
- `maps_link text` — nullable (stores the original pasted link)

#### 2. `RequestListingModal.tsx` — replace location section UI + logic

**New state:**
- `mapsLinkInput` — the raw pasted link text
- `mapsLinkError` — validation/parse error message
- `parsedPreview` — `{ lat, lng } | null` — coordinates extracted from the link, pending confirmation
- Keep existing `locating` state for the GPS fallback button

**Link parsing logic — `parseGoogleMapsLink(url: string): { lat: number; lng: number } | null`**

Handle both link formats:
- **Full links** — extract from patterns like:
  - `@lat,lng` (in the URL path e.g. `maps/place/.../@18.123,75.456,17z`)
  - `?q=lat,lng`
  - `ll=lat,lng`
  - `!3dlat!4dlng` (data parameter pattern)
- **Short links** (`maps.app.goo.gl/...`) — these redirect; can't parse client-side without a network call. For these, use a backend edge function or instruct user with a fallback. **Practical approach**: show a helper message telling the user to open the short link first and copy the full URL from the browser, OR resolve via `fetch` with `redirect: 'follow'` which works for `goo.gl` links that redirect to standard Maps URLs.

**Confirm step:**
When `parsedPreview` is set, show a small confirmation card:
```
📍 Found: 18.123456, 75.456789
[Open in Maps ↗]   [✓ Use this location]  [✗ Cancel]
```
Clicking "Use this location" sets `form.latitude`, `form.longitude`, and `mapsLink` state, then clears `parsedPreview`.

**Updated location section layout (replaces existing block lines 347–407):**

```text
┌─────────────────────────────────────────────────┐
│ 📍 Shop Location (optional)                      │
│                                                  │
│ [Paste Google Maps link here...]  [Extract →]   │
│  ← small helper text: "Open Maps → Share →      │
│    Copy link, then paste above"                  │
│                                                  │
│  — or —                                          │
│  [🔵 Use my GPS location]  (existing button)    │
│                                                  │
│  ✓ If coordinates set: show lat,lng + [Clear]   │
│                                                  │
│  ↓ Confirm preview card when parsedPreview set  │
└─────────────────────────────────────────────────┘
```

**Submit handler** — include `latitude`, `longitude`, `maps_link` in the insert payload (these 3 fields are new).

#### 3. Files to change
- **`supabase/migrations/`** — new migration SQL to add 3 columns to `shop_requests`
- **`src/components/RequestListingModal.tsx`** — replace location section (lines 347–407) with new UI + add parser function + update submit handler + update form state

#### Technical notes
- Short `goo.gl` links: `fetch(url, { redirect: 'follow', mode: 'no-cors' })` won't expose the final URL due to CORS. Instead: attempt regex on the pasted value — if it matches `maps.app.goo.gl`, show a clear inline instruction: *"This is a short link. Open it in your browser, copy the full URL from the address bar, then paste it here."* This avoids needing a proxy/edge function.
- Validate parsed coords: lat must be between -90 and 90, lng between -180 and 180.
- The GPS button stays as a second option below the paste field.
- No changes needed to the admin `RequestsTab` — it can display the new fields if present (lat/lng already handled in the detail modal from `shop_requests`).
