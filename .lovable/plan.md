## Audit Summary

### Already correct — KEEP

- Home.tsx, Shops.tsx, CategoryPage.tsx, ShopCard.tsx — all working correctly
- Share button on ShopDetail — working
- isShopOpen() logic — correct
- Multi-category pills, image upload, search, category filter in admin — all correct
- Stats bar, verified toggle, is_open manual override label — all correct
- Form validation for name/phone/area — present and working
- Auto-refresh every 60 seconds — working
- Skeleton loaders, error states — working

### Issues found — MUST FIX

**Issue 1: `confirm()` used in 2 places (lines 345 and 404 of AdminDashboard.tsx)**

- Line 345: shop delete button calls `confirm("Delete X?")` inline
- Line 404: `handleDeleteCategory` calls `confirm(msg)` — also only shows count, not shop names
Both are native browser dialogs. Must be replaced with proper AlertDialog components.

**Issue 2: Duplicate phone check saves immediately**

- Lines 607-614: checks for duplicate, shows `toast.warning`, then falls through to save anyway
- Must stop, open a confirmation dialog with: duplicate shop name + phone + area, Cancel / Save Anyway buttons
- Only proceeds if admin explicitly chooses "Save Anyway"

**Issue 3: Inactive shop accessible by direct URL**

- ShopDetail.tsx line 12-24: fetches shop with `.eq('id', id)` — no `is_active` filter
- If `is_active = false`, shop data is returned and rendered fully to the public
- Must add check: if `!shop.is_active` → render "unavailable" state (same as not found)

**Issue 4: Lat/lng range validation missing**

- validate() checks `isNaN` but not geographic range
- Must add: latitude must be -90 to 90, longitude -180 to 180

**Issue 5: DB triggers not created**

- `set_updated_at` function exists but `<db-triggers>` confirms no triggers exist
- Need a new migration with `CREATE TRIGGER IF NOT EXISTS` (safe, idempotent)

**Issue 6: Category delete shows count but not shop names**

- The new AlertDialog should fetch and display names of linked shops, not just count

**Issue 7: DOCUMENT.md overstates behavior**

- Claims dialogs use UI components (they don't yet)
- Claims duplicate phone blocks save (it doesn't yet)  
- Claims inactive shops not publicly accessible (they are currently)
- Must update after all fixes are done

---

## Plan

### Part A — Database (1 migration file)

Create triggers safely using `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` pattern:

```sql
DROP TRIGGER IF EXISTS shops_updated_at ON public.shops;
CREATE TRIGGER shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS categories_updated_at ON public.categories;
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### Part B — AdminDashboard.tsx (one file, several targeted changes)

**B1: Shop delete — replace `confirm()` with AlertDialog**

- Add state: `deleteTarget: { id: string; name: string } | null`
- Trash button sets `deleteTarget` instead of calling confirm
- Render `<AlertDialog>` at bottom of ShopsTab: "Delete [name]? This cannot be undone." with Cancel + destructive Delete button
- On confirm: call `deleteShop.mutate(id)`, clear `deleteTarget`
- Show loading state on Delete button while mutation is pending

**B2: Category delete — replace `confirm()` with AlertDialog showing shop names**

- Add state: `deleteCatTarget: { id: string; name: string } | null` + `deleteCatLinkedShops: string[]`
- When trash clicked: fetch `shop_categories` joined with `shops(name)` for that category → store names list + set `deleteCatTarget`
- Show AlertDialog with:
  - Title: "Delete [Category Name]?"
  - Body: if linked shops > 0: show list of shop names (scrollable if many), explain links will be removed but shops remain
  - If no linked shops: "No shops linked. Safe to delete."
  - Cancel + destructive "Delete Category" button
- Loading state while fetching shop names (spinner on delete button while fetching)

**B3: Duplicate phone — block save, show confirmation dialog**

- Add state: `dupePhoneShop: { id: string; name: string; phone: string; area: string | null } | null`
- In `handleSave`: after validation passes, check for duplicate phone (normalized)
- If duplicate found: `setSaving(false)`, set `dupePhoneShop`, stop — DO NOT proceed
- Render a Dialog in ShopModal:
  - Title: "Phone number already in use"
  - Show: duplicate shop's name, phone, area, categories
  - Buttons: Cancel (safe default) + "Save Anyway" (orange/warning styling)
  - "Save Anyway" resumes the save flow, clearing the dupe state
- If no duplicate: proceed normally

**B4: Lat/lng range validation**
In `validate()`, add after the `isNaN` checks:

```typescript
if (form.latitude) {
  const lat = parseFloat(form.latitude);
  if (isNaN(lat) || lat < -90 || lat > 90) errs.latitude = 'Latitude must be between -90 and 90';
}
if (form.longitude) {
  const lon = parseFloat(form.longitude);
  if (isNaN(lon) || lon < -180 || lon > 180) errs.longitude = 'Longitude must be between -180 and 180';
}
```

### Part C — ShopDetail.tsx (one targeted change)

After the query returns, before rendering, add:

```typescript
if (shop && !shop.is_active) {
  // Render unavailable state — same visual style as not found
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4">
      <p className="text-4xl">🔒</p>
      <p className="font-semibold text-foreground">This shop is currently unavailable</p>
      <p className="text-sm text-muted-foreground">It may have been temporarily deactivated.</p>
      <button onClick={() => navigate('/')} ...>Go Home</button>
    </div>
  );
}
```

This uses the same pattern as the existing "not found" state already in the file.

### Part D — DOCUMENT.md (update after code changes)

Fix these sections to reflect actual final behavior:

- Admin confirmation dialogs now use `AlertDialog` (Radix UI), not `window.confirm`
- Duplicate phone detection: blocks save, shows dialog, requires explicit "Save Anyway"
- Inactive shops: `/shop/:id` returns an unavailable screen for `is_active = false`
- Lat/lng validation now includes range check
- DB triggers: confirmed created via migration

### Files to change

```
supabase/migrations/new.sql     — create missing triggers (idempotent)
src/pages/AdminDashboard.tsx    — B1 shop delete AlertDialog
                                — B2 category delete AlertDialog with shop names
                                — B3 duplicate phone dialog (block + confirm)
                                — B4 lat/lng range validation
src/pages/ShopDetail.tsx        — C: block inactive shop on public detail page
DOCUMENT.md                     — D: update to match real behavior
```

&nbsp;

Proceed with this plan, but also follow these requirements:

1. For duplicate phone detection, normalize phone numbers before comparison:

   - strip spaces

   - strip dashes

   - strip leading +91 or 91 where appropriate

   Use normalized comparison so formatting differences do not bypass duplicate detection.

2. In the duplicate phone dialog, show as much matching-shop context as available:

   - shop name

   - phone

   - area

   - categories

   - optionally a “View Existing Shop” action if easy

3. For inactive shop direct URL handling, prefer returning the same not-found/unavailable style consistently instead of a completely different UI pattern if a reusable empty state already exists.

4. For the category delete dialog, if many linked shops exist, make the list scrollable and avoid an oversized modal.

### **Priority Order**

### Priority 1

- replace browser confirms
- fix duplicate phone flow
- fix inactive direct URL access

### Priority 2

- add lat/lng range validation
- category dialog with affected shop names

### Priority 3

- DB trigger creation
- [DOCUMENT.md](http://DOCUMENT.md) update

&nbsp;

Proceed with this plan.

Also:

- normalize phone numbers before duplicate comparison

- show categories too in the duplicate-phone dialog if available

- keep inactive shop unavailable state visually consistent with existing empty/not-found UI

- make affected shops list scrollable in category delete dialog if long

- update [DOCUMENT.md](http://DOCUMENT.md) only after implementation is complete

&nbsp;

### Files NOT changing

- `src/App.tsx` — correct
- `src/pages/Home.tsx` — correct  
- `src/pages/Shops.tsx` — correct
- `src/pages/CategoryPage.tsx` — correct
- `src/components/ShopCard.tsx` — correct
- `src/lib/shopUtils.ts` — correct
- `src/hooks/useInterval.ts` — correct
- `src/index.css` — correct
- All other pages — correct

### Component reuse

Will import `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel` from the existing `@/components/ui/alert-dialog` (already in project).
Will import `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` from `@/components/ui/dialog` for the richer duplicate-phone confirmation (not destructive — needs a "Save Anyway" button, not a cancel/confirm pair).
No new dependencies needed.