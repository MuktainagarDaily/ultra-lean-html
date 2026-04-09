

## Issues to Fix

### 1. Slug URLs cutting letters — making URLs unreadable

The current slug in the URL `/shop/amarth-igital-hoto-tudio` is missing letters. The PostgreSQL `generate_shop_slug` function has a regex issue: `\s` inside PostgreSQL string literals may not behave consistently as whitespace shorthand depending on configuration. The fix is to use explicit space characters and POSIX character classes instead.

**Fix: New migration to replace `generate_shop_slug` function**

```sql
CREATE OR REPLACE FUNCTION public.generate_shop_slug(p_name TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter   INT := 0;
BEGIN
  base_slug := lower(trim(p_name));
  -- Use explicit space and POSIX classes instead of \s
  base_slug := regexp_replace(base_slug, '[^a-z0-9 -]', '', 'g');
  base_slug := regexp_replace(base_slug, '[ -]+', '-', 'g');
  base_slug := trim(base_slug, '-');
  IF base_slug = '' THEN base_slug := 'shop'; END IF;
  candidate := base_slug;
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.shops
      WHERE slug = candidate
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    ) THEN RETURN candidate; END IF;
    counter := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;
END;$$;
```

Then **re-backfill all existing slugs** so they regenerate with the fixed function:

```sql
UPDATE public.shops SET slug = public.generate_shop_slug(name, id);
```

Also update the client-side `toSlug()` in `src/lib/shopUtils.ts` to use the same explicit pattern (it currently works in JS, but align them for consistency).

---

### 2. Autocomplete showing only 2 results instead of 5

The logic in `Home.tsx` lines 222-238 is correct (loops until `results.length >= 5`). The likely issue is that `onBlur` fires immediately when the user types, causing `searchFocused` to flicker. But more probably, the search also matches against `shop.address` and `shop.phone` fields that aren't included in the haystack.

**Fix: Expand the search haystack** to include more fields so more shops match:

```ts
const haystack = [shop.name, shop.area, shop.sub_area, shop.address, shop.description, shop.keywords, ...catNames]
  .filter(Boolean)
  .join(' ')
  .toLowerCase();
```

Adding `address`, `description`, and `keywords` to the haystack will surface more relevant matches.

Also add a `setTimeout` delay on `onBlur` to prevent the dropdown from disappearing before `onMouseDown` fires on a suggestion (race condition on mobile):

```ts
onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
```

---

### Files to change

| File | Change |
|---|---|
| New migration SQL | Fix `generate_shop_slug` regex + re-backfill all slugs |
| `src/lib/shopUtils.ts` | Align `toSlug()` regex with DB function (cosmetic) |
| `src/pages/Home.tsx` | Expand autocomplete haystack to include address/description/keywords; add blur delay |

### No `.env` changes.

