
## Plan: Location info in Requests detail modal

### What's wrong now
1. `ShopRequest` interface is missing `latitude`, `longitude`, `maps_link` — even though `select('*')` already fetches them from the DB
2. The detail dialog renders fields via a plain label/value array — lat/lng would show as raw numbers, and maps_link would just be a text string
3. `handleApprove` doesn't copy `latitude`/`longitude` to the new shop record when promoting a request

### Changes needed in `src/pages/AdminDashboard.tsx`

#### 1. Extend `ShopRequest` interface (lines 2519–2534)
Add three new optional fields:
```ts
latitude: number | null;
longitude: number | null;
maps_link: string | null;
```

#### 2. Replace the flat label/value array in the detail dialog with a smarter render (lines 2818–2835)
Keep the existing fields array as-is, but **after it**, add a dedicated **Location** row that:
- If `latitude` + `longitude` exist → shows a clickable **"Open in Maps"** link (Google Maps `?q=lat,lng`) with a `MapPin` icon and the coordinate string as secondary text
- Else if only `maps_link` exists → shows a clickable **"Open in Maps"** link using the raw URL
- If neither → shows nothing (row hidden)

The row should visually match the other detail rows (same `flex items-start gap-3` pattern with the `w-20 shrink-0` label).

#### 3. Also pass `maps_link` as a dedicated clickable link row
Show `maps_link` as a separate "Maps Link" row when it exists (useful if lat/lng weren't extracted but raw link was stored), rendered as an anchor rather than plain text.

#### 4. Copy `latitude` + `longitude` into `handleApprove` shop insert (lines 2597–2609)
Add:
```ts
latitude: (req as any).latitude || null,
longitude: (req as any).longitude || null,
```
This ensures approved shops inherit their coordinates so the Maps button works on the ShopDetail page.

### Files to change
- **`src/pages/AdminDashboard.tsx`** only:
  1. Lines 2519–2534: Add `latitude`, `longitude`, `maps_link` to `ShopRequest` interface
  2. Lines 2597–2609: Add `latitude` and `longitude` to the shop insert in `handleApprove`
  3. Lines 2813–2836 (detail dialog body): Replace/augment the flat field list to render a proper clickable location row with coords + maps_link

### Visual design of the location row
```text
LOCATION   📍 Open in Maps  ↗
           21.0325, 75.6920
```
- Label: `LOCATION` (same `text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20` style)
- Anchor: primary colour, underline on hover, opens in new tab, shows `MapPin` icon inline
- Coords shown as small muted text below the link
- If only `maps_link` (no coords): same anchor styled identically
- If neither: row not rendered at all

Also show `maps_link` as a subtle secondary "raw link" pill/badge only when coords are NOT available but maps_link IS (so it's not duplicated when both exist).
