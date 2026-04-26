## Goal
Make every shop image filename in the `shop-images` storage bucket **derived from the shop name** (slug), with a numeric suffix only when needed for uniqueness. Apply this to **new uploads** and **rename existing files** so the bucket becomes browseable and matchable to shops.

---

## Naming convention

Format: `{shop-name-slug}.webp` or `{shop-name-slug}-{n}.webp` when the slug is already taken.

Rules:
- Slug = lowercase, ASCII, hyphen-separated, stripped of punctuation (e.g. "Sai Kirana Stores!" → `sai-kirana-stores`)
- Max slug length 60 chars
- Empty/unknown name → fallback `shop`
- Collision handling: probe `slug.webp`, then `slug-1.webp`, `slug-2.webp`, … until a free name is found (probe via `storage.list` with a prefix filter — no upsert, no overwrite of unrelated files)
- Requests (pre-approval, no real shop yet) use `request-{slug}` prefix so they're easy to spot and clean up; on approval, the file gets renamed to the final shop slug

---

## Part A — New uploads (code changes)

**1. Shared helper** `src/lib/storageNaming.ts` (new):
- `slugifyShopName(name: string): string`
- `findAvailableImagePath(baseSlug: string, prefix?: string): Promise<string>` — lists bucket with the slug prefix, picks the first free `slug.webp` / `slug-N.webp`
- `uploadShopImage(blob: Blob, shopName: string, opts?: { prefix?: string }): Promise<{ path: string; publicUrl: string }>`
- `renameShopImage(oldPath: string, newShopName: string): Promise<{ path: string; publicUrl: string }>` — uses `storage.move`

**2. Wire it into the three upload sites:**
- `src/components/admin/ShopModal.tsx` — replace inline slug+timestamp logic; on shop **rename**, also call `renameShopImage` so the file follows the new name
- `src/components/admin/SpeedShopModal.tsx` — replace random `speed-…` name with the helper
- `src/components/RequestListingModal.tsx` — use `request-{slug}` prefix; rename to final slug inside `RequestsTab.tsx` when admin approves a request

**3. Old-image cleanup** stays intact (existing `extractStoragePath` + `.remove()` on replace).

---

## Part B — Rename existing files (one-time migration)

A new admin-only tool inside the existing **Data Quality** tab (`src/components/admin/DataQualityTab.tsx`) called **"Rename Shop Images"**:

Flow:
1. Loads all shops with `image_url`
2. For each, computes target slug from `shops.name`
3. Shows a preview table: `current filename → proposed filename` with status (OK / collision-resolved / skip)
4. **Dry-run by default** — admin reviews, then clicks "Apply rename"
5. On apply, per shop:
   - Resolve collision via `findAvailableImagePath`
   - `storage.move(oldPath, newPath)`
   - Update `shops.image_url` to the new public URL
   - Show progress + per-row result, stop-on-error toggle
6. Orphan scan (optional second button): list files in bucket whose path is not referenced by any `shops.image_url` — surface for manual review (do NOT auto-delete; matches project's "safe storage cleanup" rule)

No SQL migration needed — this is a data move, not a schema change. No DB structure changes.

---

## Safety rules honored
- No `upsert: true` on the new uploads (prevents accidental overwrite of an unrelated shop's image that happens to share a slug)
- Old image is removed only after the new upload succeeds (existing pattern preserved)
- Rename tool is admin-only, dry-run first, reversible per row (we keep the old URL in memory until the DB row is updated)
- Public read continues to work — bucket stays public, only paths change
- No changes to `.env`, no schema changes, no Cloud changes

---

## Files changed
- **new** `src/lib/storageNaming.ts`
- `src/components/admin/ShopModal.tsx`
- `src/components/admin/SpeedShopModal.tsx`
- `src/components/RequestListingModal.tsx`
- `src/components/admin/RequestsTab.tsx` (rename request image → shop slug on approval)
- `src/components/admin/DataQualityTab.tsx` (new "Rename Shop Images" panel)

No edits to: `.env`, DB schema, RLS, public pages, search, or any unrelated admin flow.