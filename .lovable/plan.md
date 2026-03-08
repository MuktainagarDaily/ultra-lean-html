
## Audit Results

### Issue 1 — Storage cleanup on request delete: MISSING
`handleDelete` (line 2166) only does `supabase.from('shop_requests').delete()`. No storage call. Image URL is stored as a full public URL e.g. `https://<proj>.supabase.co/storage/v1/object/public/shop-images/request-1234567890.webp`. The filename must be extracted from the URL before calling `storage.from('shop-images').remove([filename])`.

### Issue 2 — Storage cleanup on shop image replacement: MISSING
`handleImageUpload` in `ShopModal` (line 1590) generates a new `shop-${Date.now()}.webp` path, uploads it, and sets `form.image_url` to the new public URL. The old `shop.image_url` (from the original shop record) is tracked in state but never deleted. The cleanup must happen in `executeSave` after the DB update succeeds, by comparing old vs new URL.

### Issue 3 — Inactive categories showing publicly: BUG EXISTS
All public queries use `shop_categories(categories(name, icon))` without requesting `is_active` from the categories table. This means inactive/merged categories are returned and rendered. The fix is two-part:
- Add `is_active` to the nested select in all public queries
- Filter out inactive categories on the client side when building `allCats`

Affected locations:
- `Shops.tsx` line 84: `shop_categories(categories(name, icon))` → add `is_active`
- `CategoryPage.tsx` line 78: same
- `Home.tsx` line 130: same
- `ShopCard.tsx` line 29-35: filter `allCats` to only `is_active !== false`
- `ShopDetail.tsx` line 107-109: filter `allCats` to only `is_active !== false`

### Issue 4 — Category delete: ALREADY EXISTS AND WORKS
`CategoriesTab` already has `handleDeleteClick`, `handleConfirmDelete`, the `AlertDialog` with linked-shop list, and a Trash2 button on every row (lines 538-707). **No change needed here.**

---

## Implementation Plan — 3 files only

### File 1: `src/pages/AdminDashboard.tsx`

#### A. Storage path extraction helper (add near `normalizePhone`)
```typescript
/** Extract storage file path from a Supabase public URL.
 *  Returns null if the URL is not a recognized bucket URL. */
function extractStoragePath(publicUrl: string): string | null {
  try {
    const marker = '/object/public/shop-images/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length);
  } catch {
    return null;
  }
}
```

#### B. Request delete — add storage cleanup (`handleDelete`, line 2166)
Replace current `handleDelete`:
```typescript
const handleDelete = async (req: ShopRequest) => {
  setActionLoading(req.id);
  const { error } = await supabase.from('shop_requests').delete().eq('id', req.id);
  if (error) {
    toast.error('Failed to delete request');
    setActionLoading(null);
    return;
  }
  // DB deleted — now attempt storage cleanup (non-blocking)
  if (req.image_url) {
    const path = extractStoragePath(req.image_url);
    if (path) {
      const { error: storageErr } = await supabase.storage.from('shop-images').remove([path]);
      if (storageErr) {
        toast.warning('Request deleted, but image could not be removed from storage.');
      }
    }
  }
  toast.success('Request deleted');
  qc.invalidateQueries({ queryKey: ['admin-requests'] });
  setViewRequest(null);
  setActionLoading(null);
};
```

#### C. Shop image replacement — cleanup in `executeSave`
In `ShopModal`, track the old image URL at mount time:
```typescript
const oldImageUrl = useRef<string>(shop.image_url || '');
```
In `executeSave`, after successful DB update, if new `form.image_url` differs from `oldImageUrl.current`:
```typescript
// After successful DB upsert:
if (isEdit && oldImageUrl.current && oldImageUrl.current !== form.image_url) {
  const path = extractStoragePath(oldImageUrl.current);
  if (path) {
    const { error: storageErr } = await supabase.storage.from('shop-images').remove([path]);
    if (storageErr) {
      toast.warning('Shop saved, but the old image could not be removed from storage.');
    }
  }
}
```

### File 2: Public queries — add `is_active` to category joins

#### `src/pages/Shops.tsx` (line 84)
```typescript
.select('*, shop_categories(categories(name, icon, is_active))')
```
Then in `categoryOptions` derivation (line 116-127), add filter:
```typescript
const cat = sc.categories;
if (cat?.name && cat.is_active !== false && !seen.has(cat.name)) { ... }
```

#### `src/pages/CategoryPage.tsx` (line 78)
```typescript
.select('shops(*, shop_categories(categories(name, icon, is_active)))')
```

#### `src/pages/Home.tsx` (line 130)
```typescript
.select('*, shop_categories(category_id, categories(name, icon, is_active))')
```

#### `src/components/ShopCard.tsx` (lines 29-35)
Filter when building `allCats`:
```typescript
if (shop.shop_categories?.length) {
  shop.shop_categories.forEach((sc) => {
    if (sc.categories && (sc.categories as any).is_active !== false)
      allCats.push(sc.categories);
  });
} else if (shop.categories && (shop.categories as any).is_active !== false) {
  allCats.push(shop.categories);
}
```

#### `src/pages/ShopDetail.tsx` (line 107-109)
```typescript
const allCats = (shop as any).shop_categories
  ?.map((sc: any) => sc.categories)
  .filter((c: any) => c && c.is_active !== false) || [];
```
Also update the query to request `is_active`:
```typescript
.select('*, shop_categories(categories(name, icon, is_active))')
```

---

## Summary of what is NOT being changed

- Category delete: already works fully — skip
- `RequestListingModal`: not affected by any of these bugs
- Public search, filters, empty states: not affected
- All existing shop/request workflows: preserved

---

## File change count: 5 files
- `src/pages/AdminDashboard.tsx` — storage cleanup helper + request delete + shop image replace
- `src/pages/Shops.tsx` — `is_active` in category join + filter in `categoryOptions`
- `src/pages/CategoryPage.tsx` — `is_active` in category join
- `src/pages/Home.tsx` — `is_active` in category join
- `src/components/ShopCard.tsx` — filter inactive cats
- `src/pages/ShopDetail.tsx` — `is_active` in query + filter inactive cats
