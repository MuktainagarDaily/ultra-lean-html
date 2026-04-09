

## Autocomplete Suggestions for Search Box

### What's Being Built
When the user types in the Home page search box, show a dropdown below it with the top 5 matching shops. Each suggestion displays: **shop name**, **area / sub_area**, and **primary category**. Clicking a suggestion navigates directly to that shop's detail page.

### Implementation — Single File: `src/pages/Home.tsx`

**1. Compute suggestions with `useMemo`**
- Filter `shops` array by matching the search input (case-insensitive) against `name`, `area`, `sub_area`, and category names
- Limit to first 5 results
- Only compute when `search.length >= 2` and input is focused

**2. Suggestion dropdown UI**
- Render an absolute-positioned dropdown below the search `<input>` (inside the existing `<form>`)
- Show when `searchFocused && suggestions.length > 0`
- Each row: shop name (bold), area + sub_area (muted), primary category chip
- Click a row → navigate to `/shop/{slug || id}`, close dropdown
- Use `onMouseDown` (not `onClick`) to fire before `onBlur` clears focus

**3. Dismiss behavior**
- `onBlur` hides dropdown (existing `setSearchFocused(false)`)
- Submitting form hides dropdown and runs existing `handleSearch`

**4. Data available**
- `shops` already has `name`, `area`, `sub_area`, `shop_categories` with joined `categories(name, icon)` — no new queries needed

### Technical Details
- Search uses `.toLowerCase().includes()` across name, area, sub_area, category names — simple and fast for the dataset size
- `useMemo` keyed on `[shops, search, searchFocused]` ensures no unnecessary recomputation
- Dropdown z-index set high enough to overlay stat pills below

### Files Changed
- `src/pages/Home.tsx` only

