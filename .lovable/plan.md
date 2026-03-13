
## What needs to change

### 1. Database — add `slug` column to `shops` table
- Add `slug TEXT UNIQUE` column to `shops`
- Create a DB function `generate_shop_slug(name TEXT, exclude_id UUID)` that:
  - converts name to slug (lowercase, spaces→hyphens, strip special chars)
  - checks for existing slugs, appends `-1`, `-2`... if collision
- Create a trigger `before INSERT OR UPDATE` on `shops` to auto-populate `slug` from `name`
- Backfill existing rows with slugs via a one-time UPDATE

**SQL patch script** (for reference):
```sql
-- 1. Add slug column
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Slug generation function
CREATE OR REPLACE FUNCTION public.generate_shop_slug(p_name TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter INT := 0;
BEGIN
  base_slug := lower(regexp_replace(trim(p_name), '[^a-z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(base_slug, '-');
  IF base_slug = '' THEN base_slug := 'shop'; END IF;
  candidate := base_slug;
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.shops 
      WHERE slug = candidate AND (p_exclude_id IS NULL OR id != p_exclude_id)
    ) THEN RETURN candidate; END IF;
    counter := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;
END;$$;

-- 3. Trigger function
CREATE OR REPLACE FUNCTION public.set_shop_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' OR (TG_OP = 'UPDATE' AND NEW.name != OLD.name AND NEW.slug = OLD.slug) THEN
    NEW.slug := public.generate_shop_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;$$;

-- 4. Trigger
DROP TRIGGER IF EXISTS trg_shop_slug ON public.shops;
CREATE TRIGGER trg_shop_slug BEFORE INSERT OR UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_shop_slug();

-- 5. Backfill existing
UPDATE public.shops SET slug = NULL WHERE slug IS NULL OR slug = '';

-- 6. Unique constraint
ALTER TABLE public.shops ADD CONSTRAINT shops_slug_unique UNIQUE (slug);
```

---

### 2. Image auto-rename to shop name

In `ShopModal.tsx` — `handleCropComplete` function:
- Currently uploads as `shop-${Date.now()}.webp`
- Change to use a slug derived from `form.name` + timestamp suffix: `{shop-slug}-{timestamp}.webp`
- Add a helper `toFilename(name)` in the component that does the same sanitization

---

### 3. Routing — `/shop/:slug` instead of `/shop/:id` (UUID)

**`src/App.tsx`**  
- Change route from `/shop/:id` → `/shop/:slug`
- Add a legacy shim `/shop/:id` that detects UUID pattern and redirects to `/shop/:slug` by looking up the slug

Actually: support both — if the param looks like a UUID, redirect to the slug URL; if not, treat it as a slug and query by `slug` column.

**`src/pages/ShopDetail.tsx`**  
- Change the query: if param looks like UUID → query by `id`; else query by `slug`
- Or simpler: always query by slug, but on first load check if it's a UUID and redirect

Cleanest approach:
- ShopDetail: try `eq('slug', param)` first, then `eq('id', param)` as fallback (for old links)
- If found by UUID, redirect to `/shop/{slug}` for SEO/clean URL

**`src/components/ShopCard.tsx`**  
- Change `navigate(\`/shop/${shop.id}\`)` → `navigate(\`/shop/${shop.slug}\`)`
- Add `slug?: string` to the `Shop` interface

**`src/pages/Home.tsx` — CompactShopCard**  
- Change `navigate(\`/shop/${shop.id}\`)` → `navigate(\`/shop/${shop.slug}\`)`

**`src/pages/ShopDetail.tsx` — share URL**  
- Share URL already uses `window.location.href` so it auto-picks the slug URL

---

### 4. Shop image UI improvements

**`src/components/ShopCard.tsx`** — the card image area:
- Current: plain `h-32 sm:h-36` box, no overlay, no gradient
- Improved: add a subtle bottom gradient overlay so name text stays readable even with bright images; round corners consistent with card; add `aspect-[4/3]` instead of fixed height so it's responsive

**`src/pages/ShopDetail.tsx`** — shop hero image:
- Current: `h-40 sm:h-52` with no extras
- Improved: wrap in aspect-ratio box, overlay gradient at bottom, better border-radius, show `OPEN/CLOSED` badge overlaid on image corner

**`src/pages/Home.tsx` — CompactShopCard**  
- Already small, but can show image if available (currently never shows image)
- Add image thumbnail to the CompactShopCard when `shop.image_url` exists — show it as a bg or top strip

---

## Files to change

| File | Change |
|---|---|
| New migration SQL | Add `slug` column, function, trigger, backfill, unique constraint |
| `src/components/admin/ShopModal.tsx` | Rename uploaded image file to shop-slug + timestamp |
| `src/App.tsx` | Route `/shop/:slug` (keep backward compat) |
| `src/pages/ShopDetail.tsx` | Query by slug (fallback to id), redirect UUID → slug URL |
| `src/components/ShopCard.tsx` | Use `shop.slug` for navigation + improved image UI |
| `src/pages/Home.tsx` | CompactShopCard uses slug, add image thumbnail to it |
| `src/lib/shopUtils.ts` | Add `toSlug(name)` utility function |

---

## No `.env` changes
