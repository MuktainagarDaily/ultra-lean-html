## Audit Findings

### What Already Exists and Works Correctly — KEEP AS-IS

- QueryClient caching config (staleTime 30s, gcTime 5min, retry 1) — done
- `useInterval` hook + 60s auto-refresh on Shops and CategoryPage — done
- `isShopOpen()` dynamic logic with overnight support — done
- `formatTime()` 12-hour AM/PM — done
- Skeleton shimmer loading states on all pages — done
- Open Now filter on Shops + CategoryPage — done
- Multi-category junction table + RLS — done
- Admin stats header (total/active/categories) — done
- Admin shop search by name/area/phone — done
- Multi-category pill selector in ShopModal — done
- Image upload with compression to WebP — done
- GPS lat/lng fields in admin form — done
- Google Maps button on ShopCard and ShopDetail — done
- `pb-28` bottom padding on all pages — done
- Back button + Client Site link in AdminDashboard — done
- CategoryPage single-join query — done
- Error states with retry buttons — done
- Sticky headers on Shops/Category pages — done
- RLS policies: public read, authenticated write — done and permissive
- Admin auth via Supabase Auth (email + password) — done
- WhatsApp FAB with Marathi text — done

### What Exists But Needs Refinement

1. **Schema missing `is_verified` and `updated_at**` — `shops` table has `created_at` but no `updated_at` and no `is_verified` column. The V1 spec explicitly requires these. Need a safe migration (no data loss).
2. **Admin form has no validation** — name, phone, area are not validated client-side. Empty name can be submitted. No duplicate phone warning.
3. **Admin category deletion is unsafe** — can delete a category that has shops linked to it (shop_categories FK has ON DELETE CASCADE which removes the link, not the shop, but admin gets no warning). Should warn if shops are linked.
4. **Shop detail page is missing a share button** — mobile users frequently want to share shop links via WhatsApp native share. Easy to add.
5. **Home page categories are ordered alphabetically** — less useful than ordering by most popular / most common categories. The query uses `.order('name')` — this is fine for V1 but a shop count-based sort would be more useful.
6. **Admin form `is_open` manual toggle** — still present in the form even though open/closed is now automatic. This is confusing. It should either be removed or clearly labeled as "manual override / fallback". The `is_open` field is used as a fallback when no times are set.
7. **CategoryPage shows all active shops but not deduplicated** — when a shop has the same category twice in `shop_categories`, it could appear twice. The current query does `shop_categories.select('shops(...)')` — this returns one shop per junction row, so if a shop appears in the same category twice (which the `UNIQUE(shop_id, category_id)` constraint prevents) it's fine. Actually the constraint prevents this — OK.
8. **No `updated_at` means admin can't see "last edited"** — minor but useful for operations.
9. **Admin search doesn't filter by category** — the spec asks for category filter in admin. Currently only name/area/phone search. Easy to add client-side since categories are already loaded in the shop objects.
10. **No `document.md` / project documentation file** — user explicitly asked for this.

### What Is Missing But Required for V1

1. `**is_verified` column on `shops**` — required per spec. Default false. Show in admin.
2. `**updated_at` column on `shops` and `categories**` — required per spec. Auto-update via trigger.
3. **Duplicate phone detection in admin** — warn before saving if another shop has the same phone number.
4. **Category filter in admin shops tab** — client-side filter by category using already-loaded shop data.
5. **Category deletion safety warning** — show count of linked shops before allowing delete.
6. `**DOCUMENT.md` project documentation file** — user asked explicitly.
7. **Admin verified badge** — show `is_verified` status in admin table row and allow toggling.
8. **Share button on ShopDetail** — mobile native share API with WhatsApp fallback.

### What Is Duplicated/Inconsistent/Unnecessary

- `is_open` manual checkbox in admin form — confusing alongside automatic detection. Should be labeled clearly as fallback/override.
- `category_id` legacy column on `shops` still exists (used as FK) — kept for backward compat, fine.
- `src/components/NavLink.tsx` exists but is unused — harmless but dead code.
- `src/pages/Index.tsx` in file listing (summary showed it as a file) — let me check.

---

## Plan

### Database Migration (1 migration file)

Add safely to `shops` table:

- `is_verified BOOLEAN NOT NULL DEFAULT false`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Add safely to `categories` table:

- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Add trigger function to auto-update `updated_at` on both tables.

No existing data is touched. No columns removed.

### AdminDashboard improvements

1. **Show `is_verified` toggle** in the shops table row (small badge, click to toggle — same pattern as `is_active`)
2. **Add category filter dropdown** in ShopsTab header — client-side filter using the already-joined `shop.shop_categories` data
3. **Add duplicate phone warning** in `ShopModal.handleSave` — before insert, check if another shop has same phone, show `toast.warning()` but allow saving (don't block)
4. **Clarify `is_open` checkbox label** — rename to "Manual Open Override (fallback when no times set)"
5. **Category deletion safety** — before deleting a category, count linked shops and show a confirm with the count: `"This will unlink 3 shops. Are you sure?"`
6. **Stats card: add Verified count** — 4th stat card showing verified shops count

### ShopDetail improvement

- Add a native **Share button** in the header (uses `navigator.share` on mobile, falls back to copy-link with toast)

### Home page minor fix

- Categories currently ordered alphabetically — change to order by shop count descending (most-used categories first). This uses the existing `catShopCounts` already computed. Sort categories array by count before rendering.

**This plan is good. Proceed, but follow these extra rules:**

1. Keep all changes idempotent and safe to rerun.

2. Prioritize schema/data integrity and admin usability first.

3. Normalize phone numbers before duplicate detection so +91 / spaces / dashes do not bypass the warning.

4. Do not rebuild any working UI unnecessarily.

5. Keep category sorting and share button lower priority than schema/admin fixes.

6. For is_verified, keep default false and use it as a meaningful admin-checked flag.

7. For updated_at triggers, make trigger creation safe if migration runs more than once.

8. Preserve all existing data and current routes.

9. Create [DOCUMENT.md](http://DOCUMENT.md) only after code/database changes reflect reality.

### DOCUMENT.md

Create comprehensive `DOCUMENT.md` at project root covering:

- Tech stack
- All pages and their routes
- Database schema (all tables, columns, types, defaults)
- RLS policies for each table
- Storage buckets and policies
- Auth setup
- Feature list
- Known limitations / V2 backlog

### Files to change

```
supabase/migrations/new.sql      — add is_verified, updated_at columns + trigger
src/pages/AdminDashboard.tsx     — verified toggle, category filter, dupe warning, safer delete
src/pages/ShopDetail.tsx         — share button in header
src/pages/Home.tsx               — sort categories by shop count
DOCUMENT.md                      — new project documentation file
```

### Files NOT changing (already correct)

- `src/App.tsx` — QueryClient config fine
- `src/lib/shopUtils.ts` — formatTime and isShopOpen are correct
- `src/hooks/useInterval.ts` — correct
- `src/pages/Shops.tsx` — search, open-now filter, skeleton, error state all correct
- `src/pages/CategoryPage.tsx` — single join query, filter, skeleton all correct
- `src/components/ShopCard.tsx` — image, badges, action buttons all correct
- `src/pages/AdminLogin.tsx` — correct
- `src/index.css` — tokens, shimmer, pulse-open all correct
- `src/hooks/useAuth.tsx` — correct
- All RLS policies — already permissive and correct

---

### Technical Detail (database migration)

```sql
-- Add is_verified to shops
ALTER TABLE public.shops 
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;

-- Add updated_at to shops  
ALTER TABLE public.shops 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add updated_at to categories
ALTER TABLE public.categories 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Attach to shops
CREATE TRIGGER shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Attach to categories
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### AdminDashboard — category filter logic

Uses the existing joined `shop.shop_categories` data already loaded. A `<select>` dropdown above the table filters the `filtered` array client-side — no extra DB query needed.

### Duplicate phone detection

In `handleSave`, before upsert:

```typescript
if (form.phone && !isEdit) {
  const { data } = await supabase.from('shops').select('id,name').eq('phone', form.phone).limit(1);
  if (data?.length) toast.warning(`Phone already used by "${data[0].name}" — saving anyway`);
}
```

### Share button on ShopDetail

```typescript
const handleShare = async () => {
  const url = window.location.href;
  if (navigator.share) {
    await navigator.share({ title: shop.name, text: `Check out ${shop.name} on Muktainagar Daily`, url });
  } else {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  }
};
```

### Summary table


| Area              | Action                                         |
| ----------------- | ---------------------------------------------- |
| Schema            | Add `is_verified`, `updated_at`, triggers      |
| Admin: shops tab  | Add verified toggle column, category filter    |
| Admin: shop form  | Duplicate phone warning, clearer is_open label |
| Admin: categories | Safe delete with linked-shop count warning     |
| Admin: stats      | 4th card for verified count                    |
| ShopDetail        | Share button                                   |
| Home              | Sort categories by shop count                  |
| Docs              | Create DOCUMENT.md                             |
