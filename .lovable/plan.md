

## Full Audit Summary

### What already exists (keep unchanged):
- **CategoriesTab**: shows usage counts (`shopCount`) in a "Shops" column — ✅ exists and works
- **CategoryModal**: edit/rename category (icon + name + active toggle) — ✅ exists and works
- **Category delete dialog**: shows affected shop names, requires confirmation — ✅ exists and works
- **ShopModal area datalist**: hardcoded suggestions list (`Main Road`, `Station Road` etc.) — functional but static
- **normalizeArea()**: title-case normalization function — ✅ already in `executeSave()` and CSV import
- **Duplicate phone detection**: in `ShopModal` and CSV import — ✅ works
- **CategoriesTab sort**: alphabetical — ✅ works

### What is missing / the gaps Phase 5 fills:

1. **Category merge workflow**: no way to move shops from one category to another before deleting
2. **Area consistency panel**: no admin view of all unique area values in use; no way to see messy variants or bulk-rename one area to another
3. **Duplicate shop detector**: no way to surface shops with same phone or very similar name+area
4. **Category rename**: works but no rename feedback warning about CSV category matching after rename

---

## Phase 5 — Detailed Plan

### 1. Category Merge Tool (inside CategoriesTab)

Add a **Merge** action button next to each category row (only shown when `shopCount > 0`). Clicking opens a `CategoryMergeModal`:
- Title: "Merge {icon} {name} into…"
- Dropdown: select target category (excludes current category)
- Shows count: "X shops will be reassigned"
- Confirms with AlertDialog before executing
- Execution: `UPDATE shop_categories SET category_id = targetId WHERE category_id = sourceId` — then optionally disable source category (checkbox: "Also disable source category after merge")
- Uses existing `AlertDialog` pattern for confirmation
- Invalidates `admin-categories` and `admin-shops` queries on success

This is safe: shops are never touched directly, only the join table is updated.

### 2. Area Consistency Panel (new "Data Quality" tab)

Add a **5th tab** called "Data Quality" (icon: `ClipboardCheck` or `Wrench`) to `AdminDashboard`. This tab has two collapsible sections:

#### 2a. Area Summary

- Queries all shops, groups by `area` field (client-side via `useMemo`)
- Shows a table: Area name | Shop count | Actions
- Sorted by shop count descending
- "Rename" button per row: opens a small inline rename form (input + Save)
  - On save: `UPDATE shops SET area = newName WHERE area = oldName` (Supabase doesn't support bulk update directly, so fetch all shops with that area, then update each — or use a single `.eq('area', oldName)` update which Supabase does support)
  - After rename: invalidates `admin-shops`, re-fetches area list
- Shows a warning badge for suspicious area values: very short names (< 3 chars), ALL_CAPS, numeric-only

#### 2b. Possible Duplicate Shops

- Query all shops, normalize phones, find shops where `normalizePhone(phone)` matches another shop's — group them
- Also: client-side fuzzy match — shops with very similar names in the same area (optional — only if easy, defined as same first 5 characters of lowercased name + same area)
- Show as a card list: each "duplicate group" shows both shops side by side with name/phone/area
- Admin can click through to edit either shop using existing `ShopModal` (pass `onEdit`)
- No auto-delete, no auto-merge — just surfacing

---

## Files to Change

**Only `src/pages/AdminDashboard.tsx`**:

1. Add `Tab` type: add `'quality'`
2. Add `TabButton` for Data Quality tab with `Wrench` icon
3. In `CategoriesTab`: add Merge button + `CategoryMergeModal` component (inline, same file pattern)
4. Add `DataQualityTab` function component:
   - Area consistency section (live area counts, rename capability)
   - Duplicate detection section (phone-based + name+area similarity)
5. Wire up in `AdminDashboard` main render
6. Update `V2_DOC_CHANGES.md`

**No DB migration needed** — all operations use existing tables/columns via existing RLS policies. The area rename is a standard `UPDATE shops SET area = ? WHERE area = ?` which the authenticated admin user can do.

---

## Implementation Detail — Merge SQL Pattern

```typescript
// Inside CategoryMergeModal, on confirm:
await supabase
  .from('shop_categories')
  .update({ category_id: targetCategoryId })
  .eq('category_id', sourceCategoryId);
// Then optionally disable source:
if (disableSource) {
  await supabase.from('categories').update({ is_active: false }).eq('id', sourceCategoryId);
}
```

Note: if a shop already has both source AND target category, the UPDATE will create a duplicate join row (which Supabase would allow but could cause display issues). Need to handle this: fetch affected `shop_categories`, filter out shop_ids that already have target, delete those rows first, then update the rest.

## Implementation Detail — Area Rename Pattern

```typescript
await supabase
  .from('shops')
  .update({ area: newAreaName.trim().replace(/\b\w/g, c => c.toUpperCase()) })
  .eq('area', oldAreaName);
```

This is a single Supabase call that bulk-updates all shops with the old area value — safe and clean.

---

## What is deferred

- Full text-similarity duplicate detection (Levenshtein distance) — too complex for this phase
- Bulk area reassignment UI (select multiple areas → merge into one)
- Category taxonomy hierarchy
- Shop export/CSV download
- Audit log of admin changes

---

## Summary of file changes

- `src/pages/AdminDashboard.tsx` — add DataQualityTab + CategoryMergeModal + area rename logic + duplicate surfacing + new tab button
- `V2_DOC_CHANGES.md` — append Phase 5 section

